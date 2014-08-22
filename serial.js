var serial = chrome.serial;
var openSerialIDs = [];

(function(exports) {
  function saveConnections(cbDone) {
    chrome.storage.local.set({connections:openSerialIDs}, function() {
      cbDone();
    });
  }

  function SerialConnection() {
    this.connectionId = -1;
    this.callbacks = {};
    this._flushOnWrite = false;
  }

  SerialConnection.prototype.connect = function(device, callback) {
    serial.open(device, {bitrate:115200}, this.onOpen.bind(this))
    this.callbacks.connect = callback;
  };

  SerialConnection.prototype.getControlSignals = function(callback) {
    serial.getControlSignals(this.connectionId, callback);
  }

  SerialConnection.prototype.setControlSignals = function(options, callback) {
    serial.setControlSignals(this.connectionId, options, callback);
  }

  SerialConnection.prototype.flush = function(callback) {
    this.callbacks.flush = callback;
    serial.flush(this.connectionId, this.onFlush.bind(this));
  }

  SerialConnection.prototype.readBytes = function(readlen, callback) {
    var retData = "";
    var self = this;
    function processRead(readInfo) {
      retData += self.ab2str(readInfo.data);
      if (readInfo.bytesRead > 0 && readInfo.readlen - retData.length > 0) {
        setTimeout(function() {
          serial.read(this.connectionId, readlen - retData.length, processRead);
        }, 10);
      } else {
        callback(retData);
      }
    }
    serial.read(this.connectionId, readlen, processRead);
  }

  SerialConnection.prototype.read = function(readlen, callback) {
    if (arguments.length == 1 && typeof readlen === "function") {
      callback = readlen;
      readlen = 1;
    }
    // Only works for open serial ports.
    if (this.connectionId < 0) {
      throw 'Invalid connection';
    }
    this.callbacks.read = callback;
    serial.read(this.connectionId, readlen, this.onRead.bind(this));
  };

  SerialConnection.prototype.waitForPrompt = function(prompt, callback) {
    var self = this;
    setTimeout(function() {
      self.readBytes(prompt.length, function(readData) {
        if (prompt.trim() != readData.trim()) console.log("Mismatched prompts %s:%s", prompt, readData);
        callback();
      });
    }, 1000);
  }

  SerialConnection.prototype.readUntilPrompt = function(prompt, callback) {
    var self = this;
    var readBuffer = "";

    var emptyReadCount = 0;
    function handleRead(readInfo) {
      var readWait = 0;
      //console.log(readInfo);
      if (readInfo && readInfo.data) {
        if (readInfo.bytesRead > 0) {
          emptyReadCount = 0;
          readBuffer += self.ab2str(readInfo.data);

          // console.log("Read Buffer", readBuffer);
          var tailPos = readBuffer.length - prompt.length;
          if (readBuffer.substring(tailPos, tailPos + prompt.length) == prompt) {
            return callback(null, readBuffer.substring(0, tailPos));
          }
        } else {
          readWait = 50;
          if (++emptyReadCount > 100) {
            return callback("Could not read");
          }
        }
      }
      setTimeout(function() { self.read(handleRead); }, readWait);
    }
    this.read(handleRead);
  };

  SerialConnection.prototype.readUntil = function(marker, callback) {
    var self = this;
    // Only works for open serial ports.
    if (this.connectionId < 0) {
      throw 'Invalid connection';
    }
    var line = '';

    // Keep reading bytes until we've found a newline.
    var readLineHelper = function(readInfo) {
      var char = self.ab2str(readInfo.data);
      if (char == '') {
        // Nothing in the buffer. Try reading again after a small timeout.
        setTimeout(function() {
          self.read(readLineHelper);
        }.bind(self), timeout);
        return;
      }
      if (char == marker) {
        // End of line.
        callback(line);
        line = '';
        return;
      }
      line += char;
      self.read(readLineHelper)
    }.bind(self)

    this.read(readLineHelper);
  };

  SerialConnection.prototype.readLine = function(callback) {
    return this.readUntil("\n", callback);
  }

  SerialConnection.prototype.write = function(msg, callback) {
    // Only works for open serial ports.
    if (this.connectionId < 0) {
      throw 'Invalid connection';
    }
    this.callbacks.write = callback;
    this._stringToArrayBuffer(msg, function(array) {
      serial.write(this.connectionId, array, this.onWrite.bind(this));
    }.bind(this));
  };

  SerialConnection.prototype.writeRaw = function(msg, callback) {
    this.callbacks.write = callback;
    serial.write(this.connectionId, msg, this.onWrite.bind(this));
  }

  SerialConnection.prototype.unechoWrite = function(msg, callback) {
    var self = this;
    this.flushedWrite(msg, function(writeInfo) {
      // We have to add +1 for the newline here
      self.readBytes(msg.length + 1, function(readMsg) {
        if (readMsg.trim() != msg.trim()) {
          console.log("Mismatch on echo strings: -%s:%s-", readMsg.trim(), msg.trim());
        }
        callback();
      });
    });
  }

  SerialConnection.prototype.close = function(callback) {
    serial.close(this.connectionId, callback);
  }

  SerialConnection.prototype.flushedWrite = function(msg, callback) {
    this._flushOnWrite = true;
    this.write(msg, callback);
  }

  SerialConnection.prototype.onOpen = function(connectionInfo) {
    openSerialIDs.push(connectionInfo.connectionId);
    saveConnections(function() {});
    this.connectionId = connectionInfo.connectionId;
    if (this.callbacks.connect) {
      this.callbacks.connect();
    }
  };

  SerialConnection.prototype.onFlush = function() {
    serial.read(this.connectionId, 4096, function() {
      if (this.callbacks.flush) {
        this.callbacks.flush();
      }
    }.bind(this));
  };

  SerialConnection.prototype.onRead = function(readInfo) {
    if (this.callbacks.read) {
      this.callbacks.read(readInfo);
    }
  };

  SerialConnection.prototype.onWrite = function(writeInfo) {
    if (this.callbacks.write) {
      if (this._flushOnWrite) {
        var self = this;
        setTimeout(function() {
          self._flushOnWrite = false;
          serial.flush(self.connectionId, function() {
            self.callbacks.write(writeInfo);
          });
        }, 500);
      } else {
        this.callbacks.write(writeInfo);
      }
    }
  };

  /** From tcp-client */
  SerialConnection.prototype._arrayBufferToString = function(buf, callback) {
    var blob = new Blob([buf]);
    var f = new FileReader();
    f.onload = function(e) {
      callback(e.target.result)
    }
    f.readAsText(blob);
  }

  SerialConnection.prototype._stringToArrayBuffer = function(str, callback) {
    var blob = new Blob([str]);
    var f = new FileReader();
    f.onload = function(e) {
      callback(e.target.result);
    }
    f.readAsArrayBuffer(blob);
  }

  /* the arraybuffer is interpreted as an array of UTF-8 (1-byte Unicode chars) */
  SerialConnection.prototype.ab2str = function(buf) {
    var bufView=new Uint8Array(buf);
    var unis=[];
    for (var i=0; i<bufView.length; i++) {
      unis.push(bufView[i]);
    }
    return String.fromCharCode.apply(null, unis);
  };

  window.PinoccioSerial = {
    SerialConnection : SerialConnection,
    closeAll : function(cbDone) {
      debugLog("Closing all old connections");
      chrome.storage.local.get(["connections"], function(items) {
        if (!items || !items.connections || items.connections.length == 0) {
          return setTimeout(cbDone, 0);
        }
        async.forEach(items.connections, function(connId, cbStep) {
          debugLog("Closing ", connId);
          chrome.serial.close(connId, function() {
            cbStep()
          });
        }, function() {
          chrome.storage.local.remove(["connections"], function() {
            cbDone();
          });
        })
      });
    },
    getDevices : function(cbDone) {
      chrome.serial.getPorts(function(ports) {
        cbDone(ports.map(function(port) { return {path:port}; }));
      });
    },
    saveConnections : saveConnections  }
})(window);

