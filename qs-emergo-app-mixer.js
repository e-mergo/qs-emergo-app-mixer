/**
 * E-mergo App Mixer Extension
 *
 * @since 20200717
 * @author Laurens Offereins <https://github.com/lmoffereins>
 *
 * @param  {Object} qlik                Qlik's core API
 * @param  {Object} qvangular           Qlik's Angular implementation
 * @param  {Object} axios               Axios HTTP library
 * @param  {Object} $                   jQuery
 * @param  {Object} _                   Underscore
 * @param  {Object} $q                  Angular's promise library
 * @param  {Object} translator          Qlik's translation API
 * @param  {Object} Resize              Qlik's resize API
 * @param  {Object} props               Property panel definition
 * @param  {Object} initProps           Initial properties
 * @param  {Object} util                E-mergo utility functions
 * @param  {String} css                 Extension stylesheet
 * @param  {String} iframeCss           Extension iframe stylesheet
 * @param  {String} tmpl                Extension template file
 * @param  {String} modalTmpl           Extension modal template file
 * @param  {Void}                       Extension directives
 * @return {Object}                     Extension structure
 */
define([
	"qlik",
	"qvangular",
	"axios",
	"jquery",
	"underscore",
	"ng!$q",
	"translator",
	"core.utils/resize",
	"./properties",
	"./initial-properties",
	"./util/util",
	"./util/ui-util",
	"text!./style.css",
	"text!./iframe.style.css",
	"text!./template.ng.html",
	"text!./modal.ng.html",
	"./directives/directives"
], function( qlik, qvangular, axios, $, _, $q, translator, Resize, props, initProps, util, uiUtil, css, iframeCss, tmpl, modalTmpl ) {

	// Add global styles to the page
	util.registerStyle("qs-emergo-app-mixer", css);

	/**
	 * Holds the reference to the current app's API
	 *
	 * @type {Object}
	 */
	var currApp = qlik.currApp(),

	/**
	 * Holds the loaded apps
	 *
	 * This is loaded once when calling `currApp.global.getAppList()` to
	 * prevent max listener errors on the related event emitter - or when
	 * calling the Qlik Cloud's REST API to speed up interactivy.
	 *
	 * @type {Array}
	 */
	appList = (function( list ) {
		// Qlik Cloud
		if (util.isQlikCloud) {
			/**
			 * Listed apps may be locked for the user. This is the same behavior as in Qlik
			 * Cloud's app catalog.
			 *
			 * @link https://qlik.dev/apis/rest/items
			 */
			axios("/api/v1/items?resourceType=app&noActions=true").then( function( resp ) {
				function getNext( resp ) {

					// Append items to already returned list
					Array.prototype.push.apply(list, resp.data.map( function( a ) {
						return {
							value: a.name,
							label: a.name,
							id: a.resourceId
						};
					}));

					if (resp.links && resp.links.next && resp.links.next.href) {
						return axios(resp.links.next.href).then( function( resp ) {
							return getNext(resp.data);
						});
					}
				}

				return getNext(resp.data);
			}).catch(console.error);

		// QS Client Managed or QS Desktop
		} else {
			currApp.global.getAppList( function( items ) {
				Array.prototype.push.apply(list, items.map( function( a ) {
					return {
						value: a.qTitle,
						label: a.qTitle,
						id: a.qDocId
					};
				}));
			}, { openWithoutData: true });
		}

		return list;
	})([]),

	/**
	 * Query apps and set them as the searchable list's items
	 *
	 * @param  {Function} setItems
	 * @return {Void}
	 */
	getAppsSetItems = function( setItems ) {

		// Wait for appList to be defined
		var interval = setInterval( function() {
			if ("undefined" !== typeof appList) {
				setItems(appList);
				clearInterval(interval);

				// Refresh view to show the list, because calling `setItems()` does not
				// display the list contents - by default it is only displayed after
				// subsequent user interaction.
				qvangular.$rootScope.$digest();
			}
		}, 150);
	},

	/**
	 * Get the app's sheet information
	 *
	 * @param  {Object}  app     The app's API
	 * @param  {Object}  options Optional. Whether to load sheet objects. Defaults to True.
	 * @return {Promise}         List of app sheets
	 */
	getSheetInfo = function( app, options ) {

		// Define default options
		options = _.extend(options || {}, {
			loadWithObjects: true
		});

		return app.getList("sheet").then( function( sessionObject ) {

			// Remove updates for this session object before going forward
			return sessionObject.close().then( function() {
				var sheets = {};

				// Get details of each sheet's objects
				sessionObject.layout.qAppObjectList.qItems.forEach( function( a ) {

					// Get sheet details
					sheets[a.qInfo.qId] = app.getObjectProperties(a.qInfo.qId);
				});

				// Get all objects of all sheets
				return $q.all(_.extend({}, sheets)).then( function( args ) {

					// Walk list items
					return _.keys(sheets).map( function( sheetId, index ) {
						var sheet = args[sheetId].properties;

						// Add object data to list
						return {
							id: sheetId,
							title: sheet.qMetaDef.title,
							rank: sheet.rank,
							qData: sheet,
							url: getSingleSheetUrl({
								appId: app.id,
								sheetId: sheetId
							})
						};
					}).sort( function( a, b ) {
						return parseFloat(a.rank) - parseFloat(b.rank);
					});
				});
			});
		});
	},

	/**
	 * Holds the modal for the viz selector
	 *
	 * @type {Object}
	 */
	modal,

	/**
	 * Holds the object's scope id for which the viz selector modal is opened
	 *
	 * @type {Boolean|String}
	 */
	modalActiveScope = false,

	/**
	 * Open the viz selector modal for the selected app
	 *
	 * @param  {Object} $vizScope Scope object of the selected element
	 * @param  {Object} appData Selected app
	 * @return {Void}
	 */
	openVizSelector = function( $vizScope, appData ) {
		modalActiveScope = $vizScope.$id;

		/**
		 * Holds the updatable visualization properties
		 *
		 * @type {Object}
		 */
		var props = {},

		// Open the modal
		modal = qvangular.getService("luiDialog").show({
			controller: ["$scope", "$element", function( $scope, $el ) {
				$scope.okLabel = $scope.input.okLabel || translator.get("Common.OK");
				$scope.cancelLabel = $scope.input.cancelLabel || translator.get("Common.Cancel");
				$scope.loading = true;
				$scope.noObjectsFound = false;
				$scope.nothingFound = true;
				$scope.activeSheet = 0;
				$scope.prevSheetTitle = "";
				$scope.nextSheetTitle = "";

				/**
				 * Holds the app's object
				 * 
				 * Setup initial app data mimicing an app object's model
				 *
				 * @type {Object}
				 */
				$scope.app = {
					id: appData.id,
					close: function() {},
					model: {
						layout: {
							qTitle: appData.label || ""
						}
					}
				};

				/**
				 * Holds the app's navigatable sheets
				 *
				 * @type {Array}
				 */
				$scope.sheets = [];

				/**
				 * Store the relevant updatable properties
				 */
				props = {
					appId: appData.id,
					appTitle: appData.label,
					sheetId: $vizScope.layout.props.sheetId,
					sheetTitle: $vizScope.layout.props.sheetTitle,
					objId: $vizScope.layout.props.objId
				};

				// Define $el since it is not a real element due to `lui-transclude` (?)
				$el = $("#qs-emergo-app-mixer-modal");

				// Apply styles and logic to a sheet's iframe when loaded
				$scope.iframeOnload = function() {

					// Unhide the iframe and get its contents
					var $iframe = $el.find(".app-sheet-preview iframe").css("visibility", "visible").contents(),
					    activeSheetId = $scope.sheets.length && $scope.sheets[$scope.activeSheet].id,
					    interval, intervalIncr = 0; 

					// Add styles
					$("<style></style>").text(iframeCss).appendTo($iframe.find("head"));

					// Listen for clicks on a sheet's grid item
					$iframe.find("body").on("click", ".single-full-height .qvt-sheet div[data-qid]", function() {

						// Apply selected class
						$(this)
							.siblings().removeClass("qs-emergo-app-mixer-selected").end()
							.addClass("qs-emergo-app-mixer-selected");

						// Set the selected object's id and context. This is only saved when confirming the dialog.
						props.appId = $scope.app.id;
						props.appTitle = $scope.app.model.layout.qTitle;
						props.sheetId = $scope.sheets[$scope.activeSheet].id;
						props.sheetTitle = $scope.sheets[$scope.activeSheet].title;
						props.objId = this.dataset.qid;
					});

					// Attempt to mark the already selected object when it is supposed to be on this sheet
					if (props.objId && props.sheetId === activeSheetId) {

						// Poll for the object because the sheet's loading can take an unknown amount of time
						interval = setInterval( function() {
					    	var $obj = $iframe.find(".single-full-height .qvt-sheet div[data-qid=".concat(props.objId, "]"));

					    	// Increment interval counter
					    	intervalIncr++;

					    	// Set the selected value or stop after 10 attempts
					    	if ($obj.length || intervalIncr >= 10) {
					    		$obj.addClass("qs-emergo-app-mixer-selected");
						    	clearInterval(interval);
						    	intervalIncr = null;
					    	}
					    }, 400);
					}
				};

				/**
				 * Define the app popover for the modal
				 *
				 * @return {Object} Popover methods
				 */
				var appSelector = uiUtil.uiSearchableListPopover({
					title: translator.get("QCS.Common.Browser.Filter.ResourceType.Value.app"),
					get: getAppsSetItems,
					select: function( item ) {
						$scope.selectApp(item.id);
					},
					alignTo: function() {
						return $el.find(".select-app")[0];
					},
					closeOnEscape: true,
					outsideIgnore: ".select-app",
					dock: "bottom"
				}),

				/**
				 * Define the sheet popover for the modal
				 *
				 * @return {Object} Popover methods
				 */
				sheetSelector = uiUtil.uiSearchableListPopover({
					title: translator.get("Common.Sheets"),
					get: function( setItems ) {
						setItems($scope.sheets.map( function( a ) {
							return {
								value: a.title,
								id: a.id
							};
						}));
					},
					select: function( item ) {
						$scope.activeSheet = $scope.sheets.findIndex( function( a ) {
							return a.id === item.id;
						});
					},
					alignTo: function() {
						return $el.find(".select-sheet")[0];
					},
					closeOnEscape: true,
					outsideIgnore: ".select-sheet",
					dock: "bottom"
				}),

				/**
				 * Update the previous and next sheet's navigation title
				 *
				 * @return {Void}
				 */
				updateNavSheetTitles = function() {
					$scope.prevSheetTitle = $scope.canPrevSheet() ? translator.get("Tooltip.PreviousSheet", $scope.sheets[$scope.activeSheet - 1].title ) : "";
					$scope.nextSheetTitle = $scope.canNextSheet() ? translator.get("Tooltip.NextSheet", $scope.sheets[$scope.activeSheet + 1].title ) : "";
				};

				// Map list.isActive() to scope
				$scope.isAppSelectorActive = appSelector.isActive;
				$scope.isSheetSelectorActive = sheetSelector.isActive;

				/**
				 * Open the app selector
				 *
				 * @return {Void}
				 */
				$scope.toggleAppSelectionPopup = function() {
					appSelector.isActive() ? appSelector.close() : appSelector.open();
				};

				/**
				 * Open the sheet selector
				 *
				 * @return {Void}
				 */
				$scope.toggleSheetSelectionPopup = function() {
					sheetSelector.isActive() ? sheetSelector.close() : sheetSelector.open();
				};

				/**
				 * Return the active sheet's property
				 *
				 * @return {Mixed} Sheet property
				 */
				$scope.getActiveSheet = function( prop ) {
					var sheet;

					if ($scope.sheets.length && $scope.sheets[$scope.activeSheet]) {
						sheet = $scope.sheets[$scope.activeSheet];
					} else {
						sheet = {
							url: "",
							title: "Loading..."
						};
					}

					return sheet[prop] || "";
				};

				/**
				 * Select an app in the modal
				 *
				 * @param  {Object} $scope Modal scope
				 * @param  {Sstring} appId App identifier
				 * @return {Void}
				 */
				$scope.selectApp = function( appId ) {

					// Reset sheets
					$scope.sheets.length = 0;

					// Make the iframe invisible
					$el.find(".app-sheet-preview iframe").css("visibility", "hidden");

					// Close the modal's opened app. Not when it is _this_ app.
					if ($scope.app.id !== currApp.id) {
						$scope.app.close();
					}

					// Open connection with the selected app
					var app = qlik.openApp(appId);

					// Start loading
					$scope.loading = true;

					// Wait for the app sheets to be loaded
					return getSheetInfo(app).then( function( sheets ) {
						$scope.app = app;
						$scope.sheets = sheets;
						$scope.activeSheet = 0;
						updateNavSheetTitles();

						// Define whether anything was found
						$scope.nothingFound = ! sheets.length;

						// Notify loading is done
						$scope.loading = false;
					}).catch( function( error ) {
						console.error(error);

						qvangular.getService("qvConfirmDialog").show({
							title: "App Mixer error",
							message: "Inspect the browser's console for any relevant error data.",
							hideCancelButton: true
						});
					});
				};

				// Connect with the provided app
				$scope.selectApp(appData.id).then( function() {

					// When a visualization was already saved in this app, navigate to
					// the active sheet and hightlight the selected vizualization
					if ($vizScope.layout.props.objId) {
						var sheetId = $vizScope.layout.props.sheetId;

						// Find sheet of visualization
						if (! sheetId) {

							// Find in list of sheets
							var sheet = _.find($scope.sheets, function( a ) {

								// Where the visualization is in the list of cells
								return (!! _.find(a.qData.cells, function( b ) {
									return b.name === $vizScope.layout.props.objId;
								}));
							});

							if (sheet) {
								sheetId = sheet.id;
							}
						}

						// Find and set the active sheet index
						if (sheetId) {
							$scope.activeSheet = $scope.sheets.findIndex( function( a ) {
								return a.id === sheetId;
							});
						}
					}
				});

				/**
				 * Return whether a previous sheet is available
				 *
				 * @return {Boolean}
				 */
				$scope.canPrevSheet = function() {
					return $scope.activeSheet > 0;
				};

				/**
				 * Return whether a next sheet is available
				 *
				 * @return {Boolean}
				 */
				$scope.canNextSheet = function() {
					return $scope.activeSheet < ($scope.sheets.length - 1);
				};

				/**
				 * Navigate to the previous sheet
				 *
				 * @return {Void}
				 */
				$scope.goToPrevSheet = function() {
					if ($scope.activeSheet > 0) {
						$scope.activeSheet -= 1;
					}
				};

				/**
				 * Navigate to the next sheet
				 *
				 * @return {Void}
				 */
				$scope.goToNextSheet = function() {
					if ($scope.activeSheet < ($scope.sheets.length - 1)) {
						$scope.activeSheet += 1;
					}
				};

				/**
				 * Watch changes on the `activeSheet` property
				 */
				$scope.$watch("activeSheet", function( newValue ) {
					newValue = newValue || 0;

					// Check whether the sheet has objects
					if ("undefined" !== typeof $scope.sheets[newValue]) {
						$scope.noObjectsFound = ! $scope.sheets[newValue].qData.cells.length;
					}

					// Set navigation titles
					updateNavSheetTitles();
				});

				// Provide modal confirm method to the template
				// Previously modal.close() accepted a Boolean `save` argument, but
				// no more. This is a workaround for that.
				$scope.confirm = function() {

					// Save selection when closed with 'OK'
					qvangular.$apply($vizScope, function() {
						updateExtensionObject($vizScope, props);
					});

					modal.close();
				};

				// Provide modal close method to the template
				$scope.close = function() {
					modal.close();
				};

				/**
				 * Clean up when the modal is destroyed
				 *
				 * @return {Void}
				 */
				$scope.$on("$destroy", function() {
					appSelector.close();
					sheetSelector.close();
				});
			}],
			template: modalTmpl,
			input: {
				hideCancelButton: false,
				hideOkButton: false,
			},
			variant: false,
			closeOnEscape: true
		});

		// When closing the modal, remove references
		modal.closed.then( function() {
			modal = null;
			modalActiveScope = false;
		});
	},

	/**
	 * Close the viz selector modal
	 *
	 * @return {Void}
	 */
	closeVizSelector = function() {
		if (modal) {
			modal = null;
		}
	},

	/**
	 * Holds the global session options
	 *
	 * @type {Object}
	 */
	globalOpts = currApp.global.session.options,

	/**
	 * Holds the app's global baseURI
	 *
	 * Differs from qUtil.baseURI in that it does not assume the 'sense' project
	 * directly following the prefix. This is relevant for setting up `single` urls.
	 *
	 * @return {String}
	 */
	baseURI = (globalOpts.isSecure ? "https://" : "http://").concat(globalOpts.host, ":", globalOpts.port, globalOpts.prefix.replace(/\/+$/g, ""), "/"),

	/**
	 * Return the url for an app's sheet
	 *
	 * @param  {Object} options Url options
	 * @return {String} App sheet url
	 */
	getAppSheetUrl = function( options ) {
		options = options || {};

		return baseURI.concat("sense/app/", encodeURIComponent(options.appId), "/sheet/", options.sheetId);
	},

	/**
	 * Return the url for a single sheet
	 *
	 * @param  {Object} options Url options
	 * @return {String} Single sheet url
	 */
	getSingleSheetUrl = function( options ) {
		options = options || {};
		options.opts = options.opts || "nointeraction,noselections";

		return baseURI.concat("single/?appid=", encodeURIComponent(options.appId), "&sheet=", options.sheetId, "&opt=", options.opts);
	},

	/**
	 * Return the url for a single visualization object
	 *
	 * @param  {Object} options Url options
	 * @return {String} Single visualization url
	 */
	getSingleVizUrl = function( options ) {
		var url = "", lang = "", theme = "", select = "", bookmark = "", opts = [], i;

		options = options || {};

		// Interaction
		if (! options.allowInteraction) {
			opts.push("nointeraction");
		} else {

			// Selections
			if (! options.allowSelections) {
				opts.push("noselections");
			}

			// Context menu
			if (options.enableContextMenu) {
				opts.push("ctxmenu");
			}
		}

		// Language
		if (options.language) {
			lang = "&lang=".concat(options.language);
		}

		// Theme
		if (options.theme) {
			theme = "&theme=".concat(options.theme);
		}

		// Show selections bar
		if (options.showSelectionsBar) {
			opts.push("currsel");
		}

		// Clear selections
		if (options.setClearSelections) {
			select = select.concat("&select=clearall");
		}

		// Bookmark
		if (options.bookmark) {
			bookmark = "&bookmark=".concat(encodeURIComponent(options.bookmark));
		}

		// Apply selections
		if (options.applySelections) {
			for (i in options.applySelections) {
				if (options.applySelections.hasOwnProperty(i)) {
					select = select.concat("&select=", [i].concat(applySelections[i]).join(","));
				}
			}
		}

		// Join and encode options
		opts = encodeURIComponent(opts.join(","));

		// Construct url
		url = baseURI.concat("single/?appid=", encodeURIComponent(options.appId), "&obj=", options.objId, bookmark, lang, theme, "&opt=", opts, select);

		return url;
	},

	/**
	 * Update the extenion's settings
	 * 
	 * TODO: update property panel when new app is selected. This should refresh the bookmark list
	 *
	 * @param  {Object} $scope Scope data
	 * @param  {Object} props  Properties to update
	 * @return {Promise} Were patches applied?
	 */
	updateExtensionObject = function( $scope, props ) {
		var patches = [], path = "/props/", i;

		props = props || {};

		// Create patches
		for (i in props) {
			if (props.hasOwnProperty(i) && "undefined" !== typeof props[i]) {
				patches.push({
					qOp: "replace",
					qPath: path.concat(i),
					qValue: JSON.stringify(props[i])
				});
			}
		}

		// Update extension by apply patches
		return $scope.object.model.applyPatches(patches);
	},

	/**
	 * Extension controller function
	 *
	 * @param  {Object} $scope Extension scope
	 * @param  {Object} $el Scope's jQuery element
	 * @return {Void}
	 */
	controller = ["$scope", "$element", "$timeout", function( $scope, $el, $timeout ) {

		/**
		 * Define the app popover
		 *
		 * @return {Object} Popover methods
		 */
		var popover = uiUtil.uiSearchableListPopover({
			title: translator.get("QCS.Common.Browser.Filter.ResourceType.Value.app"),
			get: getAppsSetItems,
			select: function( item ) {
				openVizSelector($scope, item);
			},
			alignTo: function() {
				return $el.find(".open-button")[0];
			},
			closeOnEscape: true,
			outsideIgnore: ".open-button",
			dock: "right"
		}),

		/**
		 * Return the visualization's object url
		 *
		 * @return {String}
		 */
		getObjUrl = function() {
			var props = $scope.layout.props;

			// Override interaction when interaction in the parent's scope is not allowed
			if ($scope.options && $scope.options.noInteraction) {
				props.allowInteraction = false;
			}

			return getSingleVizUrl(props);
		},

		/**
		 * Hide the linkToSheet dialog
		 *
		 * @return {Void}
		 */
		hideVerifyDialog = function() {
			$scope.showVerifyDialog = false;
		},

		// Holds the visualization's iframe contents
		$iframe,

		/**
		 * Update the iframe to reflect changes in the extension's settings
		 *
		 * @return {Void}
		 */
		updateIframeContents = function() {
			if (! $iframe) {
				return;
			}

			$iframe.find("body")

				// Adjust styles when linkToSheet is enabled
				.toggleClass("qs-emergo-app-mixer-linkInteractionOn", $scope.linkInteractionOn && ! ($scope.options && $scope.options.noInteraction));
		},

		// Holds the timeout of the linkToSheet dialog
		verifyDialogTimeout;

		/**
		 * Holds the object id for further reference
		 *
		 * @type {String}
		 */
		$scope.objId = $scope.layout.props.objId;

		/**
		 * Update internals when a new visualization is selected
		 */
		$scope.$watch("layout.props.objId", function( newValue ) {

			// Update object id on scope
			$scope.objId = newValue;
		});

		/**
		 * Holds the viusalization's single object url
		 *
		 * An attempt to preload this resource on first load didn't result in
		 * the desired faster load time of the iframe.
		 *
		 * @see https://stackoverflow.com/a/46121536/3601434
		 *
		 * @type {String}
		 */
		$scope.singleObjectUrl = $scope.objId ? getObjUrl() : "";

		/**
		 * Holds whether linkToSheet is available
		 *
		 * @type {Boolean}
		 */
		$scope.linkInteractionOn = false;

		/**
		 * Holds whether linkToSheet dialog is shown
		 *
		 * @type {Boolean}
		 */
		$scope.showVerifyDialog = false;

		/**
		 * Holds the linkToSheet title
		 *
		 * @type {String}
		 */
		$scope.sheetLinkTitle = "";

		/**
		 * Update internals when any setting is changed
		 */
		$scope.$watch("layout.props", function( props ) {

			// Update viz url
			$scope.singleObjectUrl = $scope.objId ? getObjUrl() : "";

			// Update whether linkToSheet is available
			$scope.linkInteractionOn = props.linkToSheet && (! props.allowInteraction || ! props.allowSelections);

			// Update sheet link title
			$scope.sheetLinkTitle = $scope.layout.props.appTitle.concat(" / ", $scope.layout.props.sheetTitle);

			// Adjust styles when linkToSheet is enabled
			updateIframeContents();
		}, true);

		/**
		 * Handler to show the linkToSheet dialog
		 *
		 * @return {Void}
		 */
		$scope.onShowVerifyDialog = function() {
			if (! $scope.linkInteractionOn || $scope.object.inEditState() || ($scope.options && $scope.options.noInteraction)) {
				return;
			}

			// Show the dialog
			qvangular.$apply($scope, function() {
				$scope.showVerifyDialog = true;
				// $scope.updateVerifyDialogFontSize(); // Rebuilding this from KPI object is quite the task

				// Set timeout
				verifyDialogTimeout = $timeout(hideVerifyDialog, 3000);
			});
		};

		/**
		 * Redirect user to the link of the visualization's sheet
		 *
		 * @return {Void}
		 */
		$scope.linkToSheet = function() {
			if (! $scope.linkInteractionOn || ! $scope.showVerifyDialog || $scope.object.inEditState() || ($scope.options && $scope.options.noInteraction)) {
				return;
			}

			// Construct sheet url
			var url = getAppSheetUrl($scope.layout.props);

			// Open url
			window.open(url, $scope.layout.props.openInNewTab ? "_blank" : "_self");

			// Close dialog, clear dialog timeout
			qvangular.$apply($scope, function() {
				$scope.showVerifyDialog = false;
				$timeout.cancel(verifyDialogTimeout);
			});
		};

		/**
		 * Add styles and logic to the object's iframe when loaded
		 *
		 * @return {Void}
		 */
		$scope.iframeOnload = function() {
			var style = iframeCss;

			// Get iframe contents
			$iframe = $el.find(".obj-container iframe").contents();

			// Remove all-around padding
			style = style.concat(".single-object .single-full-height #content { padding: 0px; }");

			// Add styles
			$("<style></style>").text(style).appendTo($iframe.find("head"));

			// Listen for click in the iframe
			$iframe.on("click", "body", function( event ) {
				$scope.onShowVerifyDialog();
			});

			// Adjust styles when linkToSheet is enabled
			updateIframeContents();
		};

		/**
		 * Check whether the user has access to the Edit mode
		 *
		 * @type {Boolean}
		 */
		$scope.canSwitchToEdit = qlik.navigation.isModeAllowed(qlik.navigation.EDIT);

		/**
		 * Switch to Edit mode
		 *
		 * @return {Void}
		 */
		$scope.switchToEdit = function() {
			qlik.navigation.setMode(qlik.navigation.EDIT);

			// Open the app popover after the mode is fully switched
			qvangular.$rootScope.$$postDigest($scope.open);
		};

		/**
		 * Button select handler
		 *
		 * @return {Void}
		 */
		$scope.open = function() {
			if ($scope.object.inEditState()) {
				if ($scope.layout.props.objId) {
					openVizSelector($scope, { id: $scope.layout.props.appId });
				} else {
					popover.isActive() ? popover.close() : popover.open();
				}
			}
		};

		/**
		 * Return whether the `open` button is active
		 *
		 * @return {Boolean}
		 */
		$scope.isActive = function() {
			return popover.isActive() || modalActiveScope === $scope.$id;
		};

		// Close popover on window resize
		Resize.on("start", popover.close);

		/**
		 * Clean up when the controller is destroyed
		 *
		 * @return {Void}
		 */
		$scope.$on("$destroy", function() {
			Resize.off("start", popover.close);
			popover.close();
			verifyDialogTimeout && $timeout.cancel(verifyDialogTimeout);
		});
	}],

	/**
	 * Modify the context menu
	 *
	 * @param  {Object} object Extension object
	 * @param  {Object} menu   Menu container
	 * @param  {Object} $event HTML event data
	 * @return {Void}
	 */
	getContextMenu = function( object, menu, $event ) {
		var options = object.layout.props,
		    url = getAppSheetUrl(options);

		// Bail when we're in Edit mode
		if (! options.linkToSheet || object.inEditState()) {
			return;
		}

		// Add menu item for linkToSheet
		menu.addItem({
			label: "Navigate to sheet",
			tid: "app-mixer-link-to-sheet",
			icon: "lui-icon lui-icon--".concat(options.openInNewTab ? "new-tab" : "goto"),
			select: function() {
				window.open(url, options.openInNewTab ? "_blank" : "_self");
			}
		});
	};

	return {
		definition: props,
		initialProperties: initProps,
		template: tmpl,
		controller: controller,
		getContextMenu: getContextMenu,

		/**
		 * Setup listeners and watchers when the object is mounted
		 *
		 * @return {Void}
		 */
		mounted: function() {},

		/**
		 * Clean-up before the extension object is destroyed
		 *
		 * @return {Void}
		 */
		beforeDestroy: function() {},

		support: {
			cssScaling: false,
			sharing: false,
			snapshot: false,
			export: false,
			exportData: false
		}
	};
});
