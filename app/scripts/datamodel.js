'use strict';

var StorageType = { 'local':0, 'sync':1 };
if(Object.freeze){
  Object.freeze(StorageType);
}

function DataModel() {
  this.pushBulletApiToken = '';
  this.timeFrameStart = new Date().toISOString();
  this.timeFrameEnd = new Date().toISOString();
  this.storageType = StorageType.local;
  this.deviceId = null;
  this.subscribedEvents = {
    active: false,
    idle: false,
    locked: false
  };
}

function EventSubscription() {
  this.deviceId = '';
  this.events = [];
  this.timeframes = [];
}

function Event() {
  this.eventType = '';
  this.subscribed = false;
}

function Timeframe() {
  this.timeFrameStart = new Date().toISOString();
  this.timeFrameEnd = new Date().toISOString();
}

//TODO: add per device subscribed events
//TODO: add multiple time frames
//TODO: wire up local/synced storage

DataModel.prototype.loadFromStorage = function (callback) {
  console.log('loading from storage');
  chrome.storage.sync.get(this, callback);
};

DataModel.prototype.persistToStorage = function (callback) {
  console.log('persisting to storage');
  chrome.storage.sync.set(this, callback);
};

DataModel.prototype.isValid = function () {
  if ((this.deviceId) && (PushBullet.APIKey)){
    return true;
  }
  return false;
};

function parseTime(s) {
  var part = s.match(/(\d+):(\d+)(?: )?(am|pm)?/i);
  var hh = parseInt(part[1], 10);
  var mm = parseInt(part[2], 10);
  var ap = part[3] ? part[3].toUpperCase() : null;
  if (ap === 'AM') {
    if (hh === 12) {
      hh = 0;
    }
  }
  if (ap === 'PM') {
    if (hh !== 12) {
      hh += 12;
    }
  }
  return {
    hh: hh,
    mm: mm
  };
}

DataModel.prototype.isQuietHours = function () {
  if (!this.timeFrameStart || !this.timeFrameEnd) {
    //missing values - not using
    return false;
  }
  var ts = parseTime(this.timeFrameStart);
  var te = parseTime(this.timeFrameEnd);

  var begin = new Date();
  begin.setHours(ts.hh);
  begin.setMinutes(ts.mm);

  var end = new Date();
  end.setHours(te.hh);
  end.setMinutes(te.mm);

  var now = new Date().getTime();

  if (now >= begin.getTime() && now <= end.getTime()) {
    console.log('within range');
    return false;
  }

  console.log('not within range');
  return true;
};
