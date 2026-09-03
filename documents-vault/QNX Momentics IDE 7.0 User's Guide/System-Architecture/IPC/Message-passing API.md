---
title: "Message passing API"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Message passing API

The message-passing API consists of the following functions:

|Function|Description|
|---|---|
|[MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html)|Send a message and block until reply.|
|[MsgReceive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html)|Wait for a message.|
|[MsgReceivePulse()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulse.html)|Wait for a tiny, nonblocking message (pulse).|
|[MsgReply()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html)|Reply to a message.|
|[MsgError()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html)|Reply only with an error status. No message bytes are transferred.|
|[MsgRead()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgread.html)|Read additional data from a received message.|
|[MsgWrite()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html)|Write additional data to a reply message.|
|[MsgInfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msginfo.html)|Obtain info on a received message.|
|[MsgSendPulse()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html)|Send a tiny, nonblocking message (pulse).|
|[MsgDeliverEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html)|Deliver an event to a client.|
|[MsgKeyData()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgkeydata.html)|Key a message to allow security checks.|

For information about messages from the programming point of view, see the [Message Passing](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html) chapter of Getting Started with QNX Neutrino.
