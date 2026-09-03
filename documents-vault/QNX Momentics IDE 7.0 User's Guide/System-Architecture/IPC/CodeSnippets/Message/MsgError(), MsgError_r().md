---
title: "MsgError(), MsgError_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgError(), MsgError_r()
_Unblock a client and set its error code_

## Synopsis:

```c
#include <sys/neutrino.h>

int MsgError( int rcvid,
              int error );

int MsgError_r( int rcvid,
                int error );
```

## Arguments:

**rcvid** —

The receive ID that MsgReceive*() returned.

**error** —

The error code that you want to set for the client.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgError() and MsgError_r() kernel calls unblock the client's MsgSend*() call and set the client's error code to error. No data is transferred.

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html#msgerror__Returns) section for details.

When a server receives an unblock pulse, it typically can't determine why. In QNX Neutrino 7.0.1 or later, the server can call MsgError() with an error of -1; in this case, MsgError() sets the client's error code to whatever error the kernel stored when the unblock pulse was sent. Calling MsgError(rcvid, -1) under any other circumstances yields undefined results; the client will receive some garbage error value.

If error is EOK, the MsgSend*() call indicates success. If the error is any other value, the MsgSend*() call returns one of the following values:

- For MsgSend*_r() calls, the negative of the error value that is passed.
- For all other MsgSend*() calls, -1 with [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") set to the specified value.

An error number of ERESTART causes the sender to immediately call MsgSend*() again. Since send and reply buffers passed to [MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel") may overlap, you shouldn't use ERESTART after a call to [MsgWrite()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html "Write a reply").

**Blocking states**

None for the local case. In the network case:

STATE_REPLY

The calling thread is waiting for a network operation to complete. The calling thread is marked as REPLY-blocked on itself (the same process ID as the thread making the call).

**Native networking**

MsgError() has increased latency when you use it to communicate across a network—the server is now writing the error code to its local lsm-qnet.so, which may need to communicate with the client's lsm-qnet.so to actually transfer the error code.

## Returns:

The only difference between these functions is the way they indicate errors:

MsgError()

If an error occurs, this function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

MsgError_r()

If successful, this function returns EOK. This function does **NOT** set errno, even on success. If an error occurs, it may return any value from the Errors section.

## Errors:

### `ESRCH`

The thread indicated by rcvid doesn't exist.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

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

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "Reply with a message")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "Reply with a message")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel")

[MsgSendnc(), MsgSendnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendsv(), MsgSendsv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsv.html "Send a message to a channel")

[MsgSendsvnc(), MsgSendsvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsvnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendv(), MsgSendv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "Send a message to a channel")

[MsgSendvnc(), MsgSendvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendvs(), MsgSendvs_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvs.html "Send a message to a channel")

[MsgSendvsnc(), MsgSendvsnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvsnc.html "Send a message to a channel (non-cancellation point)")

_Unblock a client and set its error code_

## Synopsis:

```c
#include <sys/neutrino.h>

int MsgError( int rcvid,
              int error );

int MsgError_r( int rcvid,
                int error );
```

## Arguments:

**rcvid** —

The receive ID that MsgReceive*() returned.

**error** —

The error code that you want to set for the client.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgError() and MsgError_r() kernel calls unblock the client's MsgSend*() call and set the client's error code to error. No data is transferred.

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html#msgerror__Returns) section for details.

When a server receives an unblock pulse, it typically can't determine why. In QNX Neutrino 7.0.1 or later, the server can call MsgError() with an error of -1; in this case, MsgError() sets the client's error code to whatever error the kernel stored when the unblock pulse was sent. Calling MsgError(rcvid, -1) under any other circumstances yields undefined results; the client will receive some garbage error value.

If error is EOK, the MsgSend*() call indicates success. If the error is any other value, the MsgSend*() call returns one of the following values:

- For MsgSend*_r() calls, the negative of the error value that is passed.
- For all other MsgSend*() calls, -1 with [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") set to the specified value.

An error number of ERESTART causes the sender to immediately call MsgSend*() again. Since send and reply buffers passed to [MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel") may overlap, you shouldn't use ERESTART after a call to [MsgWrite()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html "Write a reply").

**Blocking states**

None for the local case. In the network case:

STATE_REPLY

The calling thread is waiting for a network operation to complete. The calling thread is marked as REPLY-blocked on itself (the same process ID as the thread making the call).

**Native networking**

MsgError() has increased latency when you use it to communicate across a network—the server is now writing the error code to its local lsm-qnet.so, which may need to communicate with the client's lsm-qnet.so to actually transfer the error code.

## Returns:

The only difference between these functions is the way they indicate errors:

MsgError()

If an error occurs, this function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

MsgError_r()

If successful, this function returns EOK. This function does **NOT** set errno, even on success. If an error occurs, it may return any value from the Errors section.

## Errors:

### `ESRCH`

The thread indicated by rcvid doesn't exist.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

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

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "Reply with a message")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "Reply with a message")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel")

[MsgSendnc(), MsgSendnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendsv(), MsgSendsv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsv.html "Send a message to a channel")

[MsgSendsvnc(), MsgSendsvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsvnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendv(), MsgSendv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "Send a message to a channel")

[MsgSendvnc(), MsgSendvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendvs(), MsgSendvs_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvs.html "Send a message to a channel")

[MsgSendvsnc(), MsgSendvsnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvsnc.html "Send a message to a channel (non-cancellation point)")
