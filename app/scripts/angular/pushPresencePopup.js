var app = angular.module('pushPresencePopup',  ['ui.bootstrap','frapontillo.bootstrap-switch']);

app.controller('PopupCtrl', ['$scope', '$window',
	function ($scope, $window) {
		$scope.model = new DataModel();
		$scope.config = new ConfigurationModel();

		var init = function(){
			chrome.storage.sync.get($scope.config, function(items){
				console.log('Binding config from synced storage');
				$scope.config = items;

				$scope.$apply();
			});

			chrome.storage.local.get($scope.model, function(items){
				console.log('Binding data model from local storage');
				$scope.model = items;

				$scope.$apply();
			});
		}
		var save = function(){
			chrome.storage.sync.set($scope.config, function(){
				console.log('Saved config');
				$scope.$apply();
			});

			chrome.storage.local.set($scope.model, function(){
				console.log('Saved data model');
				$scope.$apply();
			});
		};
		
		init();

		$scope.$watch("model.globalEnabled", function(newValue, oldValue) {
			if(newValue === oldValue){
				return;
			}
			save();
		});

		chrome.storage.onChanged.addListener(function (changes, areaName) {
			console.log(areaName + ' data changed - reloading');
			init();
		});
	}]);