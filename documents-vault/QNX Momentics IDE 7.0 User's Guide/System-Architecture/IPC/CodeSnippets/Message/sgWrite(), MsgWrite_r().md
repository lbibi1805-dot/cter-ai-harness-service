---
title: "sgWrite(), MsgWrite_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# sgWrite(), MsgWrite_r()
_Write a reply_

## Synopsis:

```c
#include <sys/neutrino.h>

ssize_t MsgWrite( int rcvid,
                  const void* msg, 
                  size_t size,
                  size_t offset );

ssize_t MsgWrite_r( int rcvid,
                    const void* msg, 
                    size_t size,
                    size_t offset );
```

## Arguments:

**rcvid** —

The value returned by MsgReceive*() when you received the message.

**msg** —

A pointer to a buffer that contains the data you want to write.

**size** —

The number of bytes that you want to write. This number must not exceed SSIZE_MAX, or the function will behave unpredictably.

These functions don't let you write past the end of the sender's buffer; they return the number of bytes actually written.

**offset** —

An offset into the sender's buffer that indicates where you want to start writing the data.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgWrite() and MsgWrite_r() kernel calls write data to the reply buffer of a thread identified by rcvid. The thread being written to must be in the REPLY-blocked state. Any thread in the receiving process is free to write to the reply message.

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html#msgwrite__Returns) section for details.

In the local case, the data transfer occurs immediately and your thread doesn't block (see “Blocking states,” below). The state of the sending thread doesn't change.

You use this function in one of these situations:

- The data arrives over time and is quite large. Rather than buffer all the data, you can use MsgWrite() to write it into the destination thread's reply message buffer, as it arrives.
- Messages are received that are larger than available buffer space. Perhaps the process is an agent between two processes and simply filters the data and passes it on. You can use MsgRead*() to read messages in small pieces, and use MsgWrite() to write messages in small pieces.

To complete a message exchange, you must call MsgReply*(). The reply doesn't need to contain any data. If it does contain data, then the data is always written at offset zero in the destination thread's reply message buffer. This is a convenient way of writing the header once all of the information has been gathered.

A single call to MsgReply*() is always more efficient than calls to MsgWrite() followed by a call to MsgReply*().

**Blocking states**

None for the local case. In the network case:

STATE_REPLY

The calling thread is waiting for a network operation to complete. The calling thread is marked as REPLY-blocked on itself (the same process ID as the thread making the call).

**Native networking**

The MsgWrite() function has increased latency when you use it to communicate across a network because the server is now writing data to its local lsm-qnet.so, which may need to communicate with the client's lsm-qnet.so to actually transfer the data. The server's MsgWrite() call effectively sends a message to the server's lsm-qnet.so to initiate this data transfer.

But since the server's lsm-qnet.so has no way to determine the size of the client's receive data area, the number of bytes reported as having been transferred by the server during its MsgWrite() call _might not be accurate_; the reported number will instead reflect the number of bytes transferred by the server to its lsm-qnet.so.

The message is buffered in the server side's lsm-qnet.so until the client replies, in order to reduce the number of network transactions.

## Returns:

The only difference between MsgWrite() and MsgWrite_r() is the way they indicate errors:

**MsgWrite()** —

If successful, this function returns the number of bytes written. If an error occurs, it returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").

**MsgWrite_r()** —

If successful, this function returns the number of bytes written. If an error occurs, it may return the negative of any value from the Errors section. This function does **NOT** set errno, even on success.

## Errors:

### `EDEADLK`

A deadlock occurred. You can avoid a deadlock by setting the _NTO_CHF_MSG_PAUSING flag when you create a channel; for more information, see [ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel") and [MsgPause()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgpause.html "Pause the processing of a message").

### `EFAULT`

A fault occurred in the sender's address space when the kernel tried to access the sender's return message buffer.

### `ESRCH`

The thread indicated by rcvid doesn't exist, is no longer REPLY-blocked on the channel, or the connection was detached.

### `ESRVRFAULT`

A fault occurred when the kernel tried to access the buffers provided.

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

[MsgRead(), MsgRead_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgread.html "Read data from a message")

[MsgReadv(), MsgReadv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreadv.html "Read data from a message")

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "Reply with a message")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "Reply with a message")

[MsgWritev(), MsgWritev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwritev.html "Write a reply")
