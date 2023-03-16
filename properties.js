/**
 * E-mergo App Mixer Property Panel definition
 *
 * @param  {Object} qlik          Qlik API
 * @param  {Object} translator    Qlik's translation API
 * @param  {Object} util          E-mergo utility functions
 * @param  {String} qext          Extension QEXT data
 * @return {Object}               Extension Property Panel definition
 */
define([
	"qlik",
	"translator",
	"./util/util",
	"text!./qs-emergo-app-mixer.qext"
], function( qlik, translator, util, qext ) {

	/**
	 * Holds the QEXT data
	 *
	 * @type {Object}
	 */
	var qext = JSON.parse(qext),

	/**
	 * Holds the settings of the configuration sub-panel
	 *
	 * @type {Object}
	 */
	configuration = {
		label: "Configuration",
		type: "items",
		component: "expandable-items",
		items: {
			general: {
				translation: "properties.general",
				type: "items",
				items: {
					allowInteraction: {
						translation: "Embed.Dialog.AllowInteraction",
						type: "boolean",
						component: "switch",
						ref: "props.allowInteraction",
						options: [ {
							value: true,
							translation: "properties.on"
						}, {
							value: false,
							translation: "properties.off"
						} ],
						defaultValue: true
					},
					allowSelections: {
						translation: "Embed.Dialog.AllowSelections",
						type: "boolean",
						component: "switch",
						ref: "props.allowSelections",
						options: [ {
							value: true,
							translation: "properties.on"
						}, {
							value: false,
							translation: "properties.off"
						} ],
						defaultValue: false,
						show: function( layout ) {
							return layout.props.allowInteraction;
						}
					},
					enableContextMenu: {
						translation: "Embed.Dialog.EnableContextMenu",
						type: "boolean",
						component: "switch",
						ref: "props.enableContextMenu",
						options: [ {
							value: true,
							translation: "properties.on"
						}, {
							value: false,
							translation: "properties.off"
						} ],
						defaultValue: false,
						show: function( layout ) {
							return layout.props.allowInteraction;
						}								
					},
					/*
					 * Language selection disabled
					 *
					 * List of languages no longer found in the `translator` module.
					 * 
					language: {
						translation: "Embed.Dialog.Languages",
						type: "string",
						component: "dropdown",
						ref: "props.language",
						options: function() {
							var options = [{
								translation: "Embed.Dialog.LanguageDefault",
								value: ""
							}];

							return options.concat(translator.languageList.filter( function( a ) {
								return -1 === ["pseudo", "zz", "qps-ploc"].indexOf(a.short);
							}).map( function( a ) {
								return {
									label: translator.get(a.translatedLabel || a.label),
									value: a.long // a.short: "en" vs a.long: "en-US"
								};
							}).sort( function( a, b ) {
								return a.label.localeCompare(b.label, translator.language);
							}));
						},
						defaultValue: ""
					},
					 */
					appTheme: {
						translation: "Embed.Dialog.SetTheme",
						type: "string",
						component: "dropdown",
						ref: "props.theme",
						options: function() {
							var options = [{
								translation: "Embed.Dialog.ThemeDefault",
								value: ""
							}];

							return qlik.getThemeList().then( function( items ) {
								return options.concat(items.map( function( a ) {
									return {
										label: a.name,
										value: a.id
									};
								}));
							});
						},
						defaultValue: ""
					}
				}
			},
			selections: {
				translation: "Embed.Dialog.Selections",
				type: "items",
				items: {
					showSelectionsBar: {
						translation: "Embed.Dialog.ShowSelectionsBar",
						type: "boolean",
						component: "switch",
						ref: "props.showSelectionsBar",
						options: [ {
							value: true,
							translation: "properties.on"
						}, {
							value: false,
							translation: "properties.off"
						} ],
						defaultValue: false
					},
					setClearSelections: {
						translation: "Embed.Dialog.SetClearSelections",
						type: "boolean",
						component: "switch",
						ref: "props.setClearSelections",
						options: [ {
							value: true,
							translation: "properties.on"
						}, {
							value: false,
							translation: "properties.off"
						} ],
						defaultValue: true
					},
					bookmark: {
						translation: "Embed.Dialog.ApplyBookmark",
						type: "string",
						component: "dropdown",
						ref: "props.bookmark",
						options: function( layout ) {
							var isCurrentApp = (layout.props.appId === qlik.currApp().id), options = [{
								translation: "Embed.Dialog.NoBookmark",
								value: ""
							}];

							if (layout.props.appId) {

								// Get the app's data
								app = isCurrentApp
									? qlik.currApp()
									: qlik.openApp(layout.props.appId, { openWithoutData: true });

								return app.getList("BookmarkList").then( function( sessionObject ) {
									return sessionObject.close().then( function() {

										// Close app connection when it's not the current one
										isCurrentApp || app.close();

										// Return bookmarks
										return options.concat(sessionObject.layout.qBookmarkList.qItems.map( function( a ) {
											return {
												label: a.qData.title,
												value: a.qInfo.qId
											};
										}));
									});
								});
							} else {
								return options;
							}
						},
						defaultValue: ""
					}
				}
			}
		}
	},

	/**
	 * Holds the settings definition of the appearance sub-panel
	 *
	 * @type {Object}
	 */
	appearance = {
		uses: "settings",
		items: {
			selections: {
				show: false
			},
			presentation: {
				translation: "properties.presentation",
				type: "items",
				items: {
					linkToSheetHint: {
						label: "When interaction or selections are enabled, the 'Link to sheet' functionality is only available through the context menu of the visualization. This context menu is only available outside of the embedded visualization.",
						component: "text",
						style: "hint"
					},
					linkToSheet: {
						translation: "properties.kpi.linkToSheet",
						type: "boolean",
						component: "switch",
						ref: "props.linkToSheet",
						options: [{
							translation: "properties.on",
							value: true
						}, {
							translation: "properties.off",
							value: false
						}],
						defaultValue: true
					},
					openInNewTab: {
						translation: "properties.kpi.openUrlInNewTab",
						type: "boolean",
						component: "switch",
						ref: "props.openInNewTab",
						options: [{
							translation: "properties.on",
							value: true
						}, {
							translation: "properties.off",
							value: false
						}],
						defaultValue: true
					}
				}
			}
		}
	},

	/**
	 * Holds the settings definition of the about sub-panel
	 *
	 * @type {Object}
	 */
	about = {
		label: function() {
			return "About ".concat(qext.title);
		},
		type: "items",
		items: {
			author: {
				label: "This Qlik Sense extension is developed by E-mergo.",
				component: "text"
			},
			version: {
				label: function() {
					return "Version: ".concat(qext.version);
				},
				component: "text"
			},
			description: {
				label: "Please refer to the accompanying documentation page for a detailed description of this extension and its features.",
				component: "text"
			},
			help: {
				label: "Open documentation",
				component: "button",
				action: function() {
					util.requireMarkdownMimetype().finally( function() {
						window.open(window.requirejs.toUrl("extensions/qs-emergo-app-mixer/docs/docs.html"), "_blank");
					});
				}
			}
		}
	};

	return {
		type: "items",
		component: "accordion",
		items: {
			configuration: configuration,
			appearance: appearance,
			about: about
		}
	};
});
