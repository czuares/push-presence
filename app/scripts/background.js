'use strict';
console.log('Events');
var model = new DataModel();
var config = new ConfigurationModel();
var lastState = null;
chrome.runtime.onInstalled.addListener(function(details) {
    if(details.reason == "install"){
      console.log('first run');
      var url = chrome.extension.getURL("options.html");
      window.open(url);
    }else{
      console.log('Upgraded: previousVersion', details.previousVersion);
    }
});
chrome.storage.onChanged.addListener(function(changes, areaName) {
    console.log(areaName + ' data changed - reloading');
    init();
});
chrome.idle.onStateChanged.addListener(function(newState) {
    onEvent(newState);
});
var onEvent = function(newState) {
    console.log('State changed to ' + newState);
    if (lastState === null) {
        lastState = newState;
    } else if (lastState === newState) {
        console.log('State has not changed since last notification. Still ' + newState);
        return;
    }
    if (!model.globalEnabled) {
        console.log('Service is paused');
        return;
    }
    model.subscriptions.forEach(function(sub) {
        if (!sub.enabled) {
            console.log('Device disabled', sub.device.name);
            return; //continue
        }
        console.log('Device enabled', sub.device.name);
        var inRange = false;
        sub.timeframes.some(function(timeframe) {
            //on first instance where a subscription matches break loop
            if (!isWithinRange(timeframe)) return false; //continue
            inRange = true;
            var handled = timeframe.events.some(function(evt) {
                if (!evt.subscribed) {
                    console.log(evt.eventType + ' not subscribed');
                    return false; //continue
                }
                if (evt.eventType === newState) {
                    lastState = newState; //only update state if subscribed
                    console.log('Subscribed to event state', evt.eventType);
                    handleEvent(sub, evt, model.showDesktopNotifications);
                    return true; //break loop
                } else {
                    console.log(evt.eventType + ' is subscribed but not current state');
                }
                return false; //continue
            });
            console.log('handled', handled);
            return handled;
        });
        if (!inRange) {
            console.log('Not within any range - Not sending notification');
            return; //continue
        }
    });
};
var handleEvent = function(sub, evt, showDesktopNotifications) {
    var msgTitle = 'PushPresence update';
    var state = navigator.onLine ? '' : '[Offline] ';
    var opt = {
        type: 'basic',
        title: state + msgTitle,
        message: evt.eventType.capitalize(),
        priority: 1,
        iconUrl: '../images/icon-128.png'
    };
    if (showDesktopNotifications) {
        chrome.notifications.create('id', opt, function(id) {
            console.log('Notification created ' + id + ' at ' + new Date());
        });
    }
    if (!navigator.onLine) {
        console.log('not online - not sending push');
        return;
    }
    if (isReady(sub)) {
        console.log('Sending push', sub.device.name);
        var res = PushBullet.push('note', sub.device.id, null, {
            title: opt.title,
            body: ( !! evt.customMessage) ? evt.customMessage : opt.message
        }, function(err, res) {
            if (err) {
                console.log('Push ERROR', err);
            } else {
                console.log('Push response', res);
            }
        });
    }
}
var isReady = function(sub) {
    return (sub.device.id) && (PushBullet.APIKey);
};
var isWithinRange = function(timeframe) {
    if (timeframe.allDay) return true;
    if (!timeframe.begin || !timeframe.end) {
        //missing values - invalid
        return false;
    }
    var dayId = new Date().getDay();
    var isTodayEnabled = timeframe.days.some(function(d) {
        var enabled = (d.id == dayId && d.enabled);
        //console.log('enabled ' + d.id + ': ' + enabled);
        return enabled;
    });
    if (!isTodayEnabled) {
        console.log('Not enabled for today - skipping');
        return;
    }
    var startTime = new Date(timeframe.begin);
    var endTime = new Date(timeframe.end);
    var now = new Date().getTime();
    var beginDate = new Date();
    beginDate.setHours(startTime.getHours());
    beginDate.setMinutes(startTime.getMinutes());
    beginDate.setSeconds(0);
    var endDate = new Date();
    endDate.setHours(endTime.getHours());
    endDate.setMinutes(endTime.getMinutes());
    endDate.setSeconds(0);
    var withinRange = (now >= beginDate.getTime() && now <= endDate.getTime());
    console.log('within range: ' + withinRange + ' range: ' + beginDate + ' to ' + endDate);
    return withinRange;
}

    function init() {
        chrome.storage.sync.get(config, function(items) {
            console.log('got synced config from storage');
            PushBullet.APIKey = items.pushBulletApiToken;
        });
        chrome.storage.local.get(model, function(items) {
            console.log('got local data from storage');
            model = items;
        });
    }
init();