/**
 * E-mergo App Mixer Custom Directives
 *
 * @package E-mergo Tools Bundle
 */
define([
	"qvangular"
], function( qvangular ) {

	// Onload
	qvangular.directive("qsEmergoAppMixerOnload", function() {
		return {
			restrict: "A",
			scope: {
				callback: "&qsEmergoAppMixerOnload"
			},
			link: function( $scope, $element, attrs ) {
				$element.on("load", function() {
					return $scope.callback();
				});
			}
		};
	});
});
