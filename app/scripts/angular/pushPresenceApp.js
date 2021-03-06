'use strict';
var pushPresenceApp = angular.module('pushPresenceApp', ['config', 'ngAnimate', 'mgcrea.ngStrap', 'pushPresenceDirectives']);
pushPresenceApp.controller('OptionsCtrl', ['$scope', '$window', '$timeout', '$aside', '$modal', '$alert', 'ENV',
    function($scope, $window, $timeout, $aside, $modal, $alert, ENV) {
        $scope.online = navigator.onLine;
        $scope.DaysOfWeek = $window.DaysOfWeek;
        var initModel = new DataModel();
        $scope.model = angular.copy(initModel);
        $scope.config = new ConfigurationModel();
        var loadingModal = $modal({
            scope: $scope,
            template: '/templates/loading.html',
            title: "Please wait...",
            content: "Populating Devices.",
            show: false
        });
        /**********************
      Private methods
      **********************/
        var showAlert = function(content, title, type) {
            $alert({
                title: title,
                content: content,
                placement: 'top',
                type: type,
                show: true
            });
        };
        var apiKeyEmpty = function() {
            return $scope.config.pushBulletApiToken.length == 0;
        }
        var apiKeySet = function() {
            return !apiKeyEmpty() && $scope.config.initialized;
        };
        var init = function() {
            chrome.storage.sync.get($scope.config, function(items) {
                console.log('Binding config from synced storage');
                $scope.config = items;
                loadApiKey();
                $scope.$apply();
            });
            chrome.storage.local.get($scope.model, function(items) {
                console.log('Binding data model from local storage');
                $scope.model = items;
                $scope.$apply();
            });
        };
        var openSettingsAsideIfNeeded = function() {
            $timeout(function() {
                if (!apiKeySet()) {
                    $scope.OpenConfig();
                }
            }, 100);
        };
        var onlineStateChanged = function(online) {
            if (!online) {
                showAlert('Your computer is not connected to the internet right now. No pushes are going to be sent.', 'Warning', 'danger');
            }
            $scope.$apply(function() {
                console.log((online ? 'on' : 'off') + 'line at ' + new Date());
                $scope.online = online;
            });
        };
        var loadApiKey = function() {
            PushBullet.APIKey = $scope.config.pushBulletApiToken;
            console.log('API key set');
        };
        var getDevices = function() {
            console.log('Populating devices');
            loadingModal.$promise.then(loadingModal.show);
            PushBullet.devices(function(err, res) {
                try {
                    if (err) {
                        console.log(err);
                        resetData(false);
                        var msg = JSON.parse(err.message);
                        showAlert(msg.error.message, 'PushBullet API Error!', 'danger');
                        return;
                    }
                    var activeDevices = _.where(res.devices, {
                        active: true
                    });
                    console.log('activeDevices', activeDevices);
                    var validSubscriptions = _.filter($scope.model.subscriptions, function(sub) {
                        //remove subs with devices missing/deactivated in PushBullet
                        return _.where(activeDevices, {
                            iden: sub.device.id
                        });
                    });
                    console.log('validSubscriptions', validSubscriptions);
                    var newSubs = _.chain(activeDevices).filter(function(dev) {
                        //filter out existing
                        return !_.some(validSubscriptions, function(sub) {
                            return sub.device.id == dev.iden;
                        });
                    }).map(function(data) {
                        return new Subscription(data);
                    }).value();
                    console.log('newSubs', newSubs);
                    $scope.model.subscriptions = _.union(validSubscriptions, newSubs);
                    console.log('$scope.model.subscriptions', $scope.model.subscriptions);
                    saveModel();
                    showAlert('Devices loaded', 'Success', 'success');
                    $scope.config.initialized = true;
                    saveConfig();
                } finally {
                    loadingModal.$promise.then(loadingModal.hide);
                }
            });
        };
        var resetData = function(prompt) {
            if (prompt && !window.confirm("Warning!\n\nAll of your saved data will be erased. Are you sure you want to continue?")) {
                return;
            }
            console.log('Resetting models');
            $scope.model = new DataModel();
            $scope.config = new ConfigurationModel();
            saveConfig();
            //no need to save model - watch handles this
        };
        var saveConfig = function() {
            chrome.storage.sync.set($scope.config, function() {
                console.log('Saved config');
                $scope.$apply();
            });
        }
        var saveModel = function() {
            chrome.storage.local.set($scope.model, function() {
                console.log('Saved data model');
                $scope.$apply();
            });
        };
        /**********************
      Watch methods
      **********************/
        $window.addEventListener("offline", function() {
            onlineStateChanged(false);
        }, false);
        $window.addEventListener("online", function() {
            onlineStateChanged(true);
        }, false);
        chrome.storage.onChanged.addListener(function(changes, areaName) {
            console.log(areaName + ' data changed - reloading');
            init();
        });
        $scope.$watch('model.globalEnabled', function(newValue, oldValue) {
            if (newValue == oldValue) return;
            if (newValue) {
                showAlert('Event monitoring is on. Pushes will be sent to subscribed devices during the specified schedules.', '', 'info');
            } else {
                showAlert('Event monitoring is currently off. While monitoring is off, no pushes will be sent to any devices.', 'Monitoring Disabled', 'warning');
            }
        }, true);
        $scope.$watch('model', function(newValue, oldValue) {
            if (newValue == oldValue) {
                console.log('model is the same');
                return;
            }
            if (initModel != null) {
                if (angular.equals(initModel, oldValue)) {
                    initModel = null;
                    return;
                }
            }
            console.log('Model changed');
            saveModel();
        }, true);
        init();
        openSettingsAsideIfNeeded();
        /**********************
      Scope methods
      **********************/
        $scope.ApiKeyUp = function(event) {
            if (event.keyCode !== 13) {
                return;
            }
            if (!apiKeySet()) {
                $scope.SetToken();
            } //input disabled when initialized
        };
        $scope.AllDisabled = function() {
            return _.every($scope.model.subscriptions, function(sub) {
                return !sub.enabled;
            });
        };
        $scope.OpenConfig = function() {
            $aside({
                template: 'templates/config.html',
                scope: $scope
            });
        };
        $scope.RemoveDevice = function(sub, e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (!window.confirm("This device will be removed. To re-add it, please refresh devices.\n\nWould you like to continue?")) return false;
            $scope.model.subscriptions = _.without($scope.model.subscriptions, sub);
        };
        $scope.SetActiveDevice = function(sub) {
            if (sub.selected) return;
            console.log('setting active device', sub);
            sub.selected = true;
            _.chain($scope.model.subscriptions).without(sub).each(function(item) {
                console.log('setting sub unselected', item);
                item.selected = false;
            });
        };
        $scope.RevokeApiToken = function() {
            if (!apiKeySet()) {
                return;
            }
            resetData(true);
        };
        $scope.ApiKeySet = function() {
            return apiKeySet();
        };
        $scope.ApiKeyEmpty = function() {
            return apiKeyEmpty();
        };
        $scope.SetToken = function() {
            if (apiKeyEmpty()) return;
            loadApiKey();
            getDevices();
            saveConfig();
        };
        $scope.GetDeviceIcon = function(sub) {
            if (!sub) return 'question';
            switch (sub.device.type) {
                case 'chrome':
                case 'firefox':
                case 'opera':
                case 'safari':
                    return 'globe';
                case 'mac':
                    return 'apple';
                case 'windows':
                    return 'windows';
                case 'android':
                case 'iphone':
                case 'ipad':
                case 'ios':
                    return 'mobile';
                default:
                    return 'question';
            }
        };
        $scope.GetDeviceName = function(sub) {
            if (!sub) return 'Unknown';
            return sub.device.name;
        };
        $scope.DeviceSelected = function() {
            console.log('Selected device ' + $scope.deviceId);
        };
        $scope.RefreshDevices = function() {
            if (!window.confirm("New devices will be added and stale devices will be removed.\n\nWould you like to continue?")) return;
            getDevices();
        };
    }
]);
pushPresenceApp.directive('appSubscription', [

    function() {
        return {
            restrict: 'E',
            scope: {
                model: "=data",
                debug: '=',
                online: '='
            },
            link: function($scope, $parent, element, attrs) {
                $scope.parent = $parent;
                $scope.AddTimeframe = function() {
                    $scope.model.timeframes.push(new Timeframe());
                };
                $scope.RemoveTimeFrame = function(idx, e) {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    console.log('index: ' + idx);
                    $scope.model.timeframes.splice(idx, 1);
                };
                $scope.DayName = function(day) {
                    return $scope.$parent.DaysOfWeek[day.id];
                };
                $scope.GetScheduleName = function(timeframe) {
                    if (timeframe.allDay) {
                        return "All Day Every Day";
                    }
                    return "Custom Schedule";
                };
                $scope.TestPush = function(deviceId) {
                    if (!deviceId) return;
                    var res = PushBullet.push('note', deviceId, null, {
                        title: 'Test from PushPresence',
                        body: 'Test Notification'
                    });
                    console.log(res);
                };
                $scope.GetEventIcon = function(e) {
                    if (!e) return 'question';
                    switch (e.eventType) {
                        case 'active':
                            return 'user';
                        case 'locked':
                            return 'lock';
                        case 'idle':
                            return 'clock-o';
                        default:
                            return 'question';
                    }
                };
                // $scope.OnAllDayChanged = function(idx) {
                //   var timeframe = $scope.model.timeframes[idx];
                //   if (timeframe.allDay) {
                //     $scope.model.timeframes[idx] = new Timeframe();
                //   }
                // };
                $scope.GetPlaceHolderText = function(evt) {
                    var title = capitalize(evt.eventType);
                    if (evt.subscribed) {
                        return title;
                    } else {
                        return title + " (Enable event to customize message)";
                    }
                };
            },
            templateUrl: '../templates/subscription.html'
        };
    }
]);
pushPresenceApp.directive('tabTitle', [

    function() {
        return {
            restrict: 'E',
            scope: {
                model: "=data",
                index: "@",
                name: "@"
            },
            link: function($scope, element, attrs) {
                var init = function() {
                    $scope.editable = false;
                    $scope.showEdit = false;
                    setName();
                };
                var setName = function() {
                    $scope.tempName = angular.copy($scope.model);
                };
                $scope.SetEditable = function(editable) {
                    $scope.editable = editable;
                };
                $scope.ShowEdit = function(show) {
                    $scope.showEdit = show;
                };
                $scope.GetPlaceHolder = function() {
                    if (!$scope.index) return $scope.name;
                    return $scope.name + " " + ($scope.index);
                };
                $scope.TabTitleKeyUp = function(event) {
                    if (event.keyCode === 13) {
                        $scope.Save();
                    }
                };
                $scope.CancelEdit = function() {
                    setName();
                    $scope.SetEditable(false);
                };
                $scope.Save = function() {
                    $scope.model = $scope.tempName;
                    $scope.SetEditable(false);
                };
                init();
            },
            templateUrl: '../templates/tab_title.html'
        };
    }
]);
pushPresenceApp.directive('focusMe', ['$timeout',
    function($timeout) {
        return {
            scope: {
                trigger: '@focusMe'
            },
            link: function(scope, element) {
                scope.$watch('trigger', function(value) {
                    if (value === "true") {
                        $timeout(function() {
                            element[0].focus();
                        });
                    }
                });
            }
        };
    }
]);
pushPresenceApp.filter('capitalize', [
    function() {
        return function(input, all) {
            //uses method found in datamodel.js
            return ( !! input) ? capitalize(input) : '';
        };
    }
]);
pushPresenceApp.config(['$alertProvider', '$asideProvider',
    function($alertProvider, $asideProvider) {
        angular.extend($alertProvider.defaults, {
            animation: 'am-fade-and-slide-top',
            placement: 'top',
            duration: 3,
            dismissable: false
        });
        angular.extend($asideProvider.defaults, {
            container: 'body',
            placement: 'right'
        });
    }
]);