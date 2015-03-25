'use strict';
var app = angular.module('pushPresencePopup', ['config','mgcrea.ngStrap', 'pushPresenceDirectives']);
app.controller('PopupCtrl', ['$scope', '$window','ENV',
    function($scope, $window, ENV) {
        $scope.model = new DataModel();
        $scope.config = new ConfigurationModel();
        var init = function() {
            chrome.storage.sync.get($scope.config, function(items) {
                console.log('Binding config from synced storage');
                $scope.config = items;
                $scope.$apply();
            });
            chrome.storage.local.get($scope.model, function(items) {
                console.log('Binding data model from local storage');
                $scope.model = items;
                $scope.$apply();
            });
        }
        var save = function() {
            chrome.storage.sync.set($scope.config, function() {
                console.log('Saved config');
                $scope.$apply();
            });
            chrome.storage.local.set($scope.model, function() {
                console.log('Saved data model');
                $scope.$apply();
            });
        };
        init();
        $scope.OpenOptions = function() {
            var url = chrome.extension.getURL("options.html");
            console.log('OpenOptions: ' + url);
            window.open(url);
            //chrome.tabs.create({ 'url': url });
        };
        $scope.$watch("model.globalEnabled", function(newValue, oldValue) {
            if (newValue === oldValue) {
                return;
            }
            console.log('model changed');
            save();
        });
        chrome.storage.onChanged.addListener(function(changes, areaName) {
            console.log(areaName + ' data changed - reloading');
            init();
        });
    }
]);