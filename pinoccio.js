var VENDOR_ID = 0x1d50;
var PRODUCT_ID = 0x6051;

// Program writing constants
var pageSize = 256;
var pageDelay = 10;

(function() {

function Device() {
  this.port = "";
  this.conn = undefined;
  this.blSeq = 0; // Bootloader command sequence
}
Device.prototype.connect = function(port, cbDone) {
  if (this.conn) setTimeout(cbDone, 0);

  this.port = port;
  console.log("Set port to ", this.port);
  this.conn = new PinoccioSerial.SerialConnection();
  this.conn.connect(this.port, function(err) {
    cbDone(err);
  });
};
Device.prototype.restart = function(cbDone) {
  var self = this;
  async.series([
    function(cbStep) {
      PinoccioSerial.closeAll(function() {
        cbStep()
      });
    },
    function(cbStep) {
      self.conn = new PinoccioSerial.SerialConnection();
      self.conn.connect(self.port, function(err) {
        console.log("Setup the new connection to ", self.port, err);
        cbStep(err);
      });
    },
    function(cbStep) {
      self.conn.setControlSignals({rts:true, dtr:true}, function() {
        cbStep();
      });
    },
    function(cbStep) {
      setTimeout(cbStep, 250);
    },
    function(cbStep) {
      self.conn.setControlSignals({rts:false, dtr:false}, function() {
        cbStep();
      });
    },
    function(cbStep) {
      setTimeout(cbStep, 50);
    }
  ], function(err) {
    cbDone(err);
  });
};
Device.prototype.drain = function(cbDone) {
  var self = this;
  self.conn.flush(function() {
    self.conn.read(1000, function(readInfo) {
      self.conn.flush(function() {
        cbDone();
      });
    });
  });
};
Device.prototype.sendBootloadCommand = function(msg, cbDone) {

  var bufLen = 6 + msg.length;
  var buffer = new ArrayBuffer(bufLen);
  var dv = new DataView(buffer);
  var checksum = 0;
  dv.setUint8(0, 0x1b);
  checksum ^= 0x1b;
  dv.setUint8(1, this.blSeq);
  checksum ^= this.blSeq;
  dv.setUint16(2, msg.length, false);
  checksum ^= dv.getUint8(2);
  checksum ^= dv.getUint8(3);
  dv.setUint8(4, 0x0e);
  checksum ^= dv.getUint8(4);
  for (var x = 0; x < msg.length; ++x) {
    dv.setUint8(5 + x, msg[x]);
    checksum ^= msg[x];
  }
  dv.setUint8(bufLen - 1, checksum);

  ++this.blSeq;
  if (this.blSeq > 0xff) this.blSeq = 0;

  this.conn.writeRaw(buffer, function() {
    this.readBootloadCommand(cbDone);
  }.bind(this));

  /*

  var conn = new SerialConnection();
  conn.connect(port, function() {
    conn.setControlSignals({rts:true, dtr:true}, function() {
      setTimeout(function() {
        conn.setControlSignals({rts:false, dtr:false}, function() {
          setTimeout(function() {
            conn.read(100, function(readInfo) {
              //setTimeout(function() {
                readCmd(conn, function() {
                })
              });
            });
           }, 50);
          });
        }, 250);
      });
    });

    */
}

var cmdReadStates = ["Start", "GetSequenceNumber", "GetMessageSize1", "GetMessageSize2", "GetToken", "GetData", "GetChecksum", "Done"];
Device.prototype.readBootloadCommand = function(timeout, cbDone) {
  var self = this;
  var state = 0;
  var timedout = false;
  var pkt = {
    message : [],
    messageLen : [],
    checksum:0
  };
  if (typeof timeout === "function") {
    cbDone = timeout;
    timeout = undefined;
  }
  if (timeout === undefined) timeout = 2000;
  setTimeout(function() { timedout = true; }, timeout);
  async.whilst (function() {
    return state < (cmdReadStates.length - 1) && !timedout
  }, function(cbStep) {
    self.conn.read(1, function(readInfo) {
      if (readInfo.length > 0) {
        var curByte = readInfo.charCodeAt(0);
        debugLog("Read: state(%s) byte(%d) char(%s)", cmdReadStates[state], curByte, String.fromCharCode(curByte));
      } else {
        debugLog("There was no data yet, waiting for some");
        return setTimeout(cbStep, 10);
      }
      pkt.checksum ^= curByte;
      switch(state) {
      case 0:
        if (curByte != 0x1b) {
          return cbStep("Invalid header byte expected 0x1b got -%s-", curByte)
        }
        ++state;
        break;
      case 1:
        var prevSeq = self.blSeq - 1;
        if (prevSeq == -1) prevSeq = 255;
        if (curByte != prevSeq) {
          return cbStep("Invalid sequence number");
        }
        ++state;
        break;
      case 2:
        pkt.messageLen.push(curByte);
        ++state;
        break;
      case 3:
        pkt.messageLen.push(curByte);
        pkt.messageLen = (pkt.messageLen[0] << 8) | pkt.messageLen[1];
        ++state;
        break;
      case 4:
        if (curByte != 0x0e) {
          return cbStep("Invalid message marker byte");
        }
        ++state;
        break;
      case 5:
        if (--pkt.messageLen == 0) ++state;
        pkt.message.push(curByte);
        break;
      case 6:
        pkt.checksum ^= curByte;
        pkt.checksum = (pkt.checksum == curByte) ? true : false;
        ++state;
        break;
      }
      cbStep();
    });
  }, function(err) {
    cbDone(err, pkt);
  })
};

Device.prototype.signOn = function(cbDone) {
  var self = this;
  self.restart(function(err) {
    console.log(err);
    //self.drain(function() {
      self.sendBootloadCommand([0x01], function(err, pkt) {
        if (err) return cbDone(err);
        console.log("Packet: ", pkt);
        if (!pkt || !pkt.message || pkt.message.length == 1) return cbDone("Unable to sign on to device");
        cbDone();
      });
    //});
  });
}
// Save the given progrma to the chip
// The programData should be in intel hex format
Device.prototype.saveProgram = function(programData, cbDone) {
  // Convert the programData into binary
  var binaryData = [];
  var curPos = 0;
  var validProgram = false;
  programData.split("\n").forEach(function(programLine) {
    //console.log("Checking ", programLine);
    if (validProgram) return;
    if (programLine[0] != ":") {
      throw new Error("Invalid program, data format incorrect");
    }

    // If it's the end we're good
    if (programLine == ":00000001FF") {
      validProgram = true;
      return;
    }

    var recordType = parseInt(programLine.substring(8, 9), 10);
    if (recordType == 2) {
      // This is a extended segment address, let's reset and keep going, we put it all together
      curPos = 0;
      return;
    } else if (recordType != 0) {
      console.error("Unexpected record type %d", recordType);
      throw new Error("Invalid program, could not parse unknown record type " + recordType);
      return;
    }

    // Break apart the line
    var linePos = parseInt(programLine.substring(3, 7), 16);
    if (linePos != curPos) {
      console.error("Got %d expected %d", linePos, curPos);
      throw new Error("Invalid program, out of order.");
    }
    var lineLength = parseInt(programLine.substring(1, 3), 16);
    // Parse the data
    for (var i = 9; i < 9 + (lineLength * 2); i += 2) {
      binaryData.push(parseInt(programLine.substring(i, i+2), 16));
    }

    curPos += lineLength;
  });

  if (!validProgram) {
    throw new Error("The program is invalid, did not parse");
  }
  // var bytes = String.fromCharCode.apply(String, binaryData);
  console.log("Parsed %d bytes", binaryData.length);

  var self = this;
  async.series([
    function(cbStep) {
      setTimeout(cbStep, 500);
    },
    function(cbStep) {
      self.signOn(cbStep);
    },
    function(cbStep) {
      // Enter programming mode
      console.log("Entering programming mode");
      self.sendBootloadCommand([0x10, 0xc8, 0x64, 0x19, 0x20, 0x00, 0x53, 0x03, 0xac, 0x53, 0x00, 0x00], function(err, resp) {
        if (err) console.error(err);
        console.log("Programming mode response: ", resp);
        cbStep();
      });
    },
    /*
    function(cbStep) {
      self.readBootloadCommand(5000, function(err, pkt) {
        console.log("Entering programming mode", pkt);
        cbStep();
      });
    },
    */
    /*
    function(cbStep) {
      self.readBootloadCommand(5000, function(err, pkt) {
        console.log("Load address ", pkt);
        cbStep();
      });
    },
    */
    // Actually do the paged write
    function(cbStep) {
      self.pagedWrite(binaryData, cbStep);
    },
    function(cbStep) {
      console.log("Exiting the programmer");
      // Exit programming mode
      self.sendBootloadCommand([0x11, 0x01, 0x01], function() {
        cbStep();
      });
    },
    /*
    function(cbStep) {
      self.readBootloadCommand(5000, function(err, pkt) {
        console.log("Signed out of the programmer", pkt);
        cbStep();
      });
    },
    */
    function(cbStep) {
      setTimeout(function() {
        self.conn.close(function() {
          connectedDevice = null;
          cbStep();
        });
      }, 1000);
    }
  ], function(err) {
    if (err) console.error(err);
    console.log("Done programming");
    cbDone(err);
  });
}

Device.prototype.pagedWrite = function(bytes, cbDone) {
  var self = this;
  var pageaddr = 0;

  async.whilst(
    function() { return pageaddr < bytes.length; },
    function(cbWhileStep) {
      async.series([
        // Set the program address
        function(cbStep) {
          var useaddr = pageaddr >> 1;
          var cmdBuf = [0x06, 0x80, 0x00, 0x00, 0x00];
          cmdBuf[3] = useaddr >> 8;
          cmdBuf[4] = useaddr & 0xff;
          self.sendBootloadCommand(cmdBuf, function(err, pkt) {
            if (err) console.error(err);
            cbStep();
          });
        },
        function(cbStep) {
          // Write the page
          var writeBytes = bytes.slice(pageaddr, (bytes.length > pageSize ? (pageaddr + pageSize) : bytes.length - 1));
          var cmdBuf = [0x13, 0x00, 0x00, 0xc1, 0x0a, 0x40, 0x4c, 0x20, 0x00, 0x00];
          cmdBuf[1] = writeBytes.length >> 8;
          cmdBuf[2] = writeBytes.length & 0xff;
          if ((pageaddr + writeBytes.length) > 0xEF000) {
            console.log("Trying to write past our valid space, bailing");
            return cbStep(new Error("Trying to write into boot loader"));
          }
          //console.log(cmdBuf.concat(writeBytes));
          self.sendBootloadCommand(cmdBuf.concat(writeBytes), function(err, resp) {
            if (err) return cbStep(err);
            pageaddr += writeBytes.length;
            setTimeout(cbStep, 4);
          });
        },
        /*
        function(cbStep) {
          setTimeout(cbStep, pageDelay);
        }
        */
      ], function(err) {
        cbWhileStep(err);
      });
    },
    function(err) {
      cbDone(err);
    }
  );
}

/* TODO:  The chip doesn't like how avrdude does this so we're still researching
Device.prototype.erase = function(cbDone) {
  self.sendBootloadCommand([], function(err, pkt) {
  });
};
*/

var overallTimer;
function checkForDevice(timeout, onFound) {
  console.log(arguments);
  // Wrap the found callback to deal with timer triggers
  var foundTriggered = false;
  function foundWrapper(err, found) {
    if (foundTriggered) return;
    if (overallTimer !== undefined) clearTimeout(overallTimer);
    if (curTimer !== undefined) clearTimeout(curTimer);
    foundTriggered = true;
    var args = Array.prototype.slice.call(arguments, 0);
    onFound(err, found);
  };

  // Overall timeout
  if (overallTimer === undefined) {
    overallTimer = setTimeout(function() {
      console.log("TIMEOUT");
      overallTimer = undefined;
      clearTimeout(curTimer);
      return foundWrapper("Timeout waiting for device", false);
    }, timeout);
  }

  console.log("Checking for USB device");
  var curTimer;
  chrome.usb.getDevices({"vendorId": VENDOR_ID, "productId": PRODUCT_ID}, function(devices) {
    if (devices && devices.length > 0) {
      console.log("our USB is plugged in");
      foundWrapper(null, true);
    } else {
      // if (!foundTriggered) {
      //   curTimer = setTimeout(function() {
      //     curTimer = undefined;
      //     checkForDevice(0, foundWrapper);
      //   }, 500);
      // }

      // We didn't find it, let HQ tell us when to detect again
      console.log("did not find our USB device");
      foundWrapper(null, false);
    }
  });
}

var usbCheckTimer;
function cancelUSBPluggedIn() {
  clearTimeout(usbCheckTimer);
}

function checkUSBPluggedIn(timeout, cbDone) {
  chrome.usb.getDevices({"vendorId": VENDOR_ID, "productId": PRODUCT_ID}, function(devices) {
    if (devices && devices.length > 0) {
      usbCheckTimer = setTimeout(function() { checkUSBPluggedIn(timeout, cbDone); }, timeout);
    } else {
      cbDone();
    }
  });
}

var connectedDevice = undefined;

function forgetDevice(cbDone) {
  connectedDevice = null;
  console.log("Forgetting connected device.");
  return cbDone(null, true);
}

function findSerial(cbDone) {
  console.log("findSerial");
  // If we're already connecte just short circuit
  if (connectedDevice) {
    console.log("Using already connected device.");
    return cbDone(null, connectedDevice);
  }

  var usbttyRE = /(tty\.usb|ttyACM|COM\d+)/;
  var port;
  console.log("Going to close all");
  PinoccioSerial.closeAll(function() {
    PinoccioSerial.getDevices(function(devices) {
      async.detect(devices, function(device, cbStep) {
        console.log("Check ", device);
        if (usbttyRE.test(device.path)) {
          console.log("Actually trying ", device);
          trySerial(device.path, function(conn) {
            if (!conn) return cbStep(false);
            console.log("This is the one: ", device.path);
            port = device.path;
            connectedDevice = new Device;
            connectedDevice.port = port;
            connectedDevice.conn = conn;
            cbStep(true);
          });
        } else {
          setTimeout(function() { cbStep(false); }, 0);
        }
      }, function(result) {
        return cbDone(null, connectedDevice);
      })
    });
  });
  /*
  chrome.serial.getPorts(function(ports) {
    async.detect(ports, function(portName, cbStep) {
      console.log("Trying ", portName);
      if (usbttyRE.test(portName)) {
        trySerial(portName, function(conn) {
          if (!conn) return cbStep(false);
          console.log("This is the one: ", portName);
          port = portName;
          connectedDevice = new Device;
          connectedDevice.conn = conn;
          cbStep(true);
        });
      } else {
        cbStep(false);
      }
    }, function(result) {
      if (!result) return cbDone("Could not find the device");

      return cbDone(null, connectedDevice);
    });
  });
  */
}

function trySerial(port, cbDone) {
  var conn = new PinoccioSerial.SerialConnection();
  var foundIt = false;
  async.series([
    function(cbStep) {
      console.log("Connecting");
      conn.connect(port, cbStep);
    },
    function(cbStep) {
      console.log("Waiting a bit");
      setTimeout(cbStep, 1000);
    },
    /*
    function(cbStep) {
      console.log("Flushing");
      conn.flush(function(result) {
        if (!result) {
          conn.close(function() {
            cbStep("Could not flush");
          });
        } else {
          cbStep();
        }
      });
    },
    */
    /*
    function(cbStep) {
      conn.unechoWrite("\n", function() {
        cbStep();
      });
    },
    function(cbStep) {
      conn.waitForPrompt("\n> ", function() {
        cbStep();
      });
    },
    */
    /*
    function(cbStep) {
      console.log("running scout.report");
      conn.unechoWrite("scout.report\n", function(writeInfo) {
        cbStep();
      });
    },
    */
    function(cbStep) {
      console.log("Waiting for prompt");
      conn.readUntilPrompt("> ", function(err, readData) {
        if (err) return cbStep(err);
        //console.log("Read -%s-", readData);
        if (/Pinoccio/.test(readData)) {
          console.log("Found it");
          foundIt = true;
        } else {
          console.error("No scout ready");
        }
        cbStep();
      });
    }],

    function(err) {
      cbDone(foundIt ? conn : undefined);
    }
  );
}

function closeAll(cbDone) {
  PinoccioSerial.closeAll(cbDone);
}

window.pinoccio = {
  Device:Device,
  checkForDevice:checkForDevice,
  findSerial:findSerial,
  forgetDevice:forgetDevice,
  checkUSBPluggedIn:checkUSBPluggedIn,
  cancelUSBPluggedIn:cancelUSBPluggedIn,
  closeAll:closeAll
};

})(window);
