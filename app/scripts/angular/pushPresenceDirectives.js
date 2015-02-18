'use strict';
angular.module('pushPresenceDirectives', []).directive('toggleBtn', [
    function() {
        return {
            restrict: 'A',
            templateUrl: '/templates/toggle_btn.html',
            replace: true,
            scope: {
                enabled: '=bind'
            }
        };
    }
]);