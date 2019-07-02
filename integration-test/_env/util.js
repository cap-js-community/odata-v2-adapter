"use strict";

function callRead(oRequest, sPath, oHeaders) {
  oRequest = oRequest.get(sPath);
  if (oHeaders) {
    Object.keys(oHeaders).forEach(vKey => {
      oRequest.set(vKey, oHeaders[vKey]);
    });
  }
  return oRequest;
}

function callWrite(oRequest, sPath, oPayload, bUpdate, oHeaders) {
  oRequest = bUpdate ? oRequest.patch(sPath) : oRequest.post(sPath);
  oHeaders = oHeaders || {};
  Object.keys(oHeaders).forEach(vKey => {
    oRequest.set(vKey, oHeaders[vKey]);
  });
  oRequest = oRequest.set("content-type", oHeaders["content-type"] || "application/json").send(oPayload);
  return oRequest;
}

function callDelete(oRequest, sPath) {
  return oRequest.delete(sPath);
}

module.exports = {
  callRead,
  callWrite,
  callDelete
};
