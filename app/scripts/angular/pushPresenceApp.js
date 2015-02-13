'use strict';
var pushPresenceApp = angular.module('pushPresenceApp', ['ui.bootstrap', 'frapontillo.bootstrap-switch', 'ngAside', 'toastr']);
pushPresenceApp.controller('OptionsCtrl', ['$scope', '$window', '$timeout', '$aside', 'toastr',
    function($scope, $window, $timeout, $aside, toastr) {
        $scope.debug = false;
        $scope.online = navigator.onLine;
        $scope.DaysOfWeek = $window.DaysOfWeek;
        var initModel = new DataModel();
        $scope.model = angular.copy(initModel);
        $scope.config = new ConfigurationModel();
        /**********************
          Private methods 
         **********************/
        var apiKeySet = function() {
            return $scope.config.pushBulletApiToken.length == 32;
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
                toastr.error('Your computer is not connected to the internet right now. No pushes are going to be sent.', 'Warning');
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
            PushBullet.devices(function(err, res) {
                if (err) {
                    //console.log(err);
                    resetData(false);
                    var msg = JSON.parse(err.message);
                    toastr.error(msg.error.message,'PushBullet API Error!', {
                      positionClass: 'toast-top-center', 
                      closeButon : true,
                      timeOut: 0,
                      extendedTimeout: 10000
                    });
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
                toastr.success('Devices loaded');
            });
        };
        var resetData = function(prompt) {
          if(prompt && !window.confirm("Warning!\n\nAll of your saved data will be erased. Are you sure you want to continue?")){
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
                //toastr.info('Saving...','', {timeOut: 500 });
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
                toastr.info('Event monitoring is on. Pushes will be sent to subscribed devices during the specified schedules.');
            } else {
                toastr.warning('Event monitoring is currently off. While monitoring is off, no pushes will be sent to any devices.', 'Monitoring Disabled');
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
        $scope.AllDisabled = function() {
            return _.every($scope.model.subscriptions, function(sub) {
                return !sub.enabled;
            });
        };
        $scope.OpenConfig = function() {
            $aside.open({
                templateUrl: 'templates/config.html',
                placement: 'right',
                backdrop: true,
                scope: $scope,
                controller: function($scope, $modalInstance) {
                    $scope.ok = function(e) {
                        $modalInstance.close();
                        e.stopPropagation();
                    };
                }
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
        $scope.SetToken = function() {
            if (!apiKeySet()) return;
            loadApiKey();
            getDevices();
            saveConfig();
        };
        $scope.GetDeviceIcon = function(sub) {
            if (!sub) return 'question';
            //console.log('Device type', sub.device.type);
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
pushPresenceApp.directive('isodatestring', function() {
    return {
        //hack to handle chrome storage not persisting date objects
        //https://stackoverflow.com/a/12947995
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, element, attr, ngModel) {
            ngModel.$parsers.push(function(date) {
                return new Date(date).toISOString();
            });
        }
    };
});
pushPresenceApp.directive('appSubscription', function() {
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
            //   console.log('Timeframe changed');
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
});
pushPresenceApp.directive('tabTitle', function() {
    return {
        restrict: 'E',
        scope: {
            model: "=data",
            index: "@",
            name: "@"
        },
        link: function($scope, $parent, element, attrs) {
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
            $scope.KeyUp = function(event) {
                if (event.keyCode === 13) {
                    $scope.Save();
                }
            };
            $scope.CancelEdit = function() {
                console.log('canceling edit');
                setName();
                $scope.SetEditable(false);
            };
            $scope.Save = function() {
                console.log('save');
                $scope.model = $scope.tempName;
                $scope.SetEditable(false);
            };
            init();
        },
        templateUrl: '../templates/tab_title.html'
    };
});
pushPresenceApp.directive('focusMe', function($timeout) {
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
});
pushPresenceApp.filter('capitalize', function() {
    return capitalize;
});
pushPresenceApp.config(function(toastrConfig) {
    angular.extend(toastrConfig, {
        positionClass: 'toast-top-left',
        timeOut: 5000,
        extendedTimeOut: 2000,
        maxOpened: 1
    });
});
var capitalize = function(input, all) {
    //uses prototype method found in datamodel.js
    return ( !! input) ? input.capitalize() : '';
};