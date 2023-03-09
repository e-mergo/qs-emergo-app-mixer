/**
 * E-mergo App Mixer Initial Properties
 *
 * @package E-mergo Tools Bundle
 *
 * @param  {String} qext          Extension QEXT data
 * @return {Object}               Initial properties
 */
define([
	"text!./qs-emergo-app-mixer.qext"
], function( qext ) {
	return {
		props: {
			appId: "",
			appTitle: "",
			sheetId: "",
			sheetTitle: "",
			objId: "",
			allowInteraction: true,
			allowSelections: false,
			enableContextMenu: false,
			language: "",
			theme: "",
			showSelectionsBar: false,
			setClearSelections: true,
			bookmark: "",
			linkToSheet: true,
			openInNewTab: true
		},
		showTitles: false,
		title: JSON.parse(qext).title,
		subtitle: ""
	};
});
