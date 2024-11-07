"use strict"

module.exports = {
  dateTime: /datetime(?:offset)?(?:'|%27)(.+?)(?:'|%27)/gi,
  time: /time(?:'|%27)(.+?)(?:'|%27)/gi,
  date: /datetime(?:'|%27)(.+?)(?:'|%27)/gi,
}
