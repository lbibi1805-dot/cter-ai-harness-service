---
title: "MsgInfo(), MsgInfo_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgInfo(), MsgInfo_r()
_Get additional information about a message_

## Synopsis:

```c
#include <sys/neutrino.h>

int MsgInfo( int rcvid,
             struct _msg_info* info );

int MsgInfo_r( int rcvid,
               struct _msg_info* info );
```

## Arguments:

**rcvid** —

The receive ID that MsgReceive*() returned when you received the message.

**info** —

A pointer to a [_msg_info](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/_msg_info.html "Information about a message") structure where the function can store information about the message.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgInfo() and MsgInfo_r() kernel calls get additional information about a received message and store it in the specified _msg_info structure.

These functions are identical, except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msginfo.html#msginfo__Returns) section for details.

The info->msglen and info->srcmsglen members are valid only until the next call to MsgRead*() or MsgWrite*().

**Blocking states**

These calls don't block.

## Returns:

The only difference between these functions is the way they indicate errors:

MsgInfo()

If an error occurs, this function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

MsgInfo_r()

If successful, this function returns EOK. This function does **NOT** set errno, even on success. If an error occurs, it may return any value from the Errors section.

## Errors:

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `ESRCH`

The thread indicated by rcvid doesn't exist.

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Message Passing (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html "Message Passing (Getting Started with QNX Neutrino)")

### Related reference  

[ChannelCreate(), ChannelCreate_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel")

[_msg_info](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/_msg_info.html "Information about a message")

[MsgRead(), MsgRead_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgread.html "Read data from a message")

[MsgReadv(), MsgReadv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreadv.html "Read data from a message")

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel")

[MsgSendv(), MsgSendv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "Send a message to a channel")
