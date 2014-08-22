var serial = chrome.serial;

var serialConnections = {};

(function(exports) {

  function handleRead(readInfo) {
    var serialConn = serialConnections[readInfo.connectionId];
    if (!serialConn) {
      console.error("Blackholed read data", readInfo, serialConnections);
      return;
    }

    var bufView = new Uint8Array(readInfo.data);
    var unis = [];
    for (var i=0; i<bufView.length; i++) {
      unis.push(bufView[i]);
    }
    var chunk = String.fromCharCode.apply(null, unis);
    //console.log("chunk ==%s==", chunk);
    serialConn.readBuffer += chunk;
    //console.log("Reabuffer :%s:", serialConn.readBuffer);

    //console.log("handleRead ", readInfo, " buffer is now ", serialConn.readBuffer);
  };

  if (serial.onReceive) serial.onReceive.addListener(handleRead);
  if (serial.onReceiveError) {
    serial.onReceiveError.addListener(function(errorInfo) {
      console.error("Receive error ", errorInfo);
    });
  }

  function SerialConnection() {
    this.connectionId = -1;
    this.callbacks = {};
    this._flushOnWrite = false;
    this.readBuffer = "";
  }

  SerialConnection.prototype.connect = function(device, callback) {
    console.log(serial);
    var options = {
      name:"Pinoccio",
      bitrate:115200
    };
    serial.connect(device, options, this.onOpen.bind(this))
    this.callbacks.connect = callback;
  };

  SerialConnection.prototype.getControlSignals = function(callback) {
    serial.getControlSignals(this.connectionId, callback);
  }

  SerialConnection.prototype.setControlSignals = function(options, callback) {
    serial.setControlSignals(this.connectionId, options, callback);
  }

  SerialConnection.prototype.flush = function(callback) {
    this.readBuffer = "";
    console.log("Flushing for ", this.readBuffer);
    this.callbacks.flush = callback;
    serial.flush(this.connectionId, this.onFlush.bind(this));
  }

  SerialConnection.prototype.readBytes = function(readlen, callback) {
    var retData = "";
    var self = this;
    function processRead(readData) {
      retData += readData;
      if (readData.length > 0 && readlen - retData.length > 0) {
        setTimeout(function() {
          self.read(readlen - retData.length, processRead);
        }, 10);
      } else {
        callback(retData);
      }
    }
    this.read(readlen, processRead);
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

    if (this.readBuffer.length == 0) {
      return this.onRead("");
    }

    var actualReadLen = Math.min(readlen, this.readBuffer.length);
    //console.log("actualReadLen(%d)", actualReadLen);
    var readData = this.readBuffer.slice(0, actualReadLen);
    this.readBuffer = this.readBuffer.slice(actualReadLen);
    readData.bytesRead = actualReadLen;
    //console.log("Read ", readData);
    this.onRead(readData);
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
    function handleRead(readData) {
      var readWait = 0;
      //console.log("Appending ", readData);
      if (readData.length > 0) {
        emptyReadCount = 0;
        readBuffer += readData;
      } else {
        readWait = 100;
        if (++emptyReadCount > 200) {
          return callback("Could not read");
        }
      }
      var tailPos = readBuffer.length - prompt.length;
      //console.log("Checking -%s- from =%s=", readBuffer.substring(readBuffer.length, readBuffer.length - prompt.length), readBuffer);
      if (readBuffer.substring(readBuffer.length, readBuffer.length - prompt.length) == prompt) {
        return callback(null, readBuffer.substring(0, tailPos));
      }
      //console.log("Buffer is ", readBuffer);
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
    var readLineHelper = function(readData) {
      var char = readData;
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
      serial.send(this.connectionId, array, this.onWrite.bind(this));
    }.bind(this));
  };

  SerialConnection.prototype.writeRaw = function(msg, callback) {
    this.callbacks.write = callback;
    serial.send(this.connectionId, msg, this.onWrite.bind(this));
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
    serial.disconnect(this.connectionId, callback);
  }

  SerialConnection.prototype.flushedWrite = function(msg, callback) {
    this._flushOnWrite = true;
    this.write(msg, callback);
  }

  SerialConnection.prototype.onOpen = function(connectionInfo) {
    this.connectionId = connectionInfo.connectionId;
    serialConnections[this.connectionId] = this;
    if (this.callbacks.connect) {
      this.callbacks.connect();
    }
  };

  SerialConnection.prototype.onFlush = function(result) {
    if (this.callbacks.flush) {
      this.callbacks.flush(result);
    }
  };

  SerialConnection.prototype.onRead = function(readData) {
    if (this.callbacks.read) {
      this.callbacks.read(readData);
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

  window.PinoccioSerial2 = {
    SerialConnection : SerialConnection,
    closeAll : function(cbDone) {
      chrome.serial.getConnections(function(connInfos) {
        async.forEach(connInfos, function(connInfo, cbStep) {
          chrome.serial.disconnect(connInfo.connectionId, function(result) {
            cbStep();
          });
        }, function() {
          cbDone();
        });
      });
    },
    getDevices : function(cbDone) {
      chrome.serial.getDevices(cbDone);
    }
  }
})(window);

