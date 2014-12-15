 
// STK message constants
module.exports.MESSAGE_START = '\x1B'
module.exports.TOKEN         = '\x0E'

// STK general command constants
module.exports.CMD_SIGN_ON               = '\x01'
module.exports.CMD_SET_PARAMETER         = '\x02'
module.exports.CMD_GET_PARAMETER         = '\x03'
module.exports.CMD_SET_DEVICE_PARAMETERS = '\x04'
module.exports.CMD_OSCCAL                = '\x05'
module.exports.CMD_LOAD_ADDRESS          = '\x06'
module.exports.CMD_FIRMWARE_UPGRADE      = '\x07'

// STK ISP command constants
module.exports.CMD_ENTER_PROGMODE_ISP  = '\x10'
module.exports.CMD_LEAVE_PROGMODE_ISP  = '\x11'
module.exports.CMD_CHIP_ERASE_ISP      = '\x12'
module.exports.CMD_PROGRAM_FLASH_ISP   = '\x13'
module.exports.CMD_READ_FLASH_ISP      = '\x14'
module.exports.CMD_PROGRAM_EEPROM_ISP  = '\x15'
module.exports.CMD_READ_EEPROM_ISP     = '\x16'
module.exports.CMD_PROGRAM_FUSE_ISP    = '\x17'
module.exports.CMD_READ_FUSE_ISP       = '\x18'
module.exports.CMD_PROGRAM_LOCK_ISP    = '\x19'
module.exports.CMD_READ_LOCK_ISP       = '\x1A'
module.exports.CMD_READ_SIGNATURE_ISP  = '\x1B'
module.exports.CMD_READ_OSCCAL_ISP     = '\x1C'
module.exports.CMD_SPI_MULTI           = '\x1D'

// STK PP command constants
module.exports.CMD_ENTER_PROGMODE_PP   = '\x20'
module.exports.CMD_LEAVE_PROGMODE_PP   = '\x21'
module.exports.CMD_CHIP_ERASE_PP       = '\x22'
module.exports.CMD_PROGRAM_FLASH_PP    = '\x23'
module.exports.CMD_READ_FLASH_PP       = '\x24'
module.exports.CMD_PROGRAM_EEPROM_PP   = '\x25'
module.exports.CMD_READ_EEPROM_PP      = '\x26'
module.exports.CMD_PROGRAM_FUSE_PP     = '\x27'
module.exports.CMD_READ_FUSE_PP        = '\x28'
module.exports.CMD_PROGRAM_LOCK_PP     = '\x29'
module.exports.CMD_READ_LOCK_PP        = '\x2A'
module.exports.CMD_READ_SIGNATURE_PP   = '\x2B'
module.exports.CMD_READ_OSCCAL_PP      = '\x2C'
module.exports.CMD_SET_CONTROL_STACK   = '\x2D'

// STK HVSP command constants
module.exports.CMD_ENTER_PROGMODE_HVSP = '\x30'
module.exports.CMD_LEAVE_PROGMODE_HVSP = '\x31'
module.exports.CMD_CHIP_ERASE_HVSP     = '\x32'
module.exports.CMD_PROGRAM_FLASH_HVSP  = '\x33'
module.exports.CMD_READ_FLASH_HVSP     = '\x34'
module.exports.CMD_PROGRAM_EEPROM_HVSP = '\x35'
module.exports.CMD_READ_EEPROM_HVSP    = '\x36'
module.exports.CMD_PROGRAM_FUSE_HVSP   = '\x37'
module.exports.CMD_READ_FUSE_HVSP      = '\x38'
module.exports.CMD_PROGRAM_LOCK_HVSP   = '\x39'
module.exports.CMD_READ_LOCK_HVSP      = '\x3A'
module.exports.CMD_READ_SIGNATURE_HVSP = '\x3B'
module.exports.CMD_READ_OSCCAL_HVSP    = '\x3C'

// STK status constants
// Success
module.exports.STATUS_CMD_OK = '\x00'
// Warnings
module.exports.STATUS_CMD_TOUT          = '\x80'
module.exports.STATUS_RDY_BSY_TOUT      = '\x81'
module.exports.STATUS_SET_PARAM_MISSING = '\x82'
// Errors
module.exports.STATUS_CMD_FAILED  = '\xC0'
module.exports.STATUS_CKSUM_ERROR = '\xC1'
module.exports.STATUS_CMD_UNKNOWN = '\xC9'

// STK parameter constants
module.exports.STATUS_BUILD_NUMBER_LOW  = '\x80'
module.exports.STATUS_BUILD_NUMBER_HIGH = '\x81'
module.exports.STATUS_HW_VER            = '\x90'
module.exports.STATUS_SW_MAJOR          = '\x91'
module.exports.STATUS_SW_MINOR          = '\x92'
module.exports.STATUS_VTARGET           = '\x94'
module.exports.STATUS_VADJUST           = '\x95'
module.exports.STATUS_OSC_PSCALE        = '\x96'
module.exports.STATUS_OSC_CMATCH        = '\x97'
module.exports.STATUS_SCK_DURATION      = '\x98'
module.exports.STATUS_TOPCARD_DETECT    = '\x9A'
module.exports.STATUS_STATUS            = '\x9C'
module.exports.STATUS_DATA              = '\x9D'
module.exports.STATUS_RESET_POLARITY    = '\x9E'
module.exports.STATUS_CONTROLLER_INIT   = '\x9F'

// STK answer constants
module.exports.ANSWER_CKSUM_ERROR = '\xB0'
