---
title: "MsgReceivePulse(), MsgReceivePulse_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgReceivePulse(), MsgReceivePulse_r()
_Receive a pulse on a channel_

## Synopsis:

```c
#include <sys/neutrino.h>

int MsgReceivePulse( int chid,
                     void * pulse,
                     size_t bytes,
                     struct _msg_info * info );

int MsgReceivePulse_r( int chid,
                       void * pulse,
                       size_t bytes,
                       struct _msg_info * info );
```

## Arguments:

**chid** —

The ID of a channel that you established by calling [ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel"), or -1 to dissociate the thread from the last channel it received on (see “[Server boost](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Server_boost.html)” in the Interprocess Communication chapter of the System Architecture guide).

**pulse** —

A void * pointer to a [struct _pulse](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/_pulse.html "Structure that describes a pulse") structure where the function can store the received data.

If this buffer isn't big enough to contain a struct _pulse structure, you'll get an EFAULT.

**bytes** —

The size of the buffer.

**info** —

The function doesn't update this structure, so you typically pass NULL for this argument.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgReceivePulse() and MsgReceivePulse_r() kernel calls wait for a pulse to arrive on the channel identified by chid and place the received data in the buffer pointed to by pulse. If the buffer is large enough, the number of bytes written to it is the size of a struct _pulse structure.

These functions are identical, except in the way they indicate errors; see the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulse.html#msgreceivepulse__Returns) section for details.

If a pulse is waiting on the channel when you call MsgReceivePulse(), the calling thread doesn't block, and the pulse is immediately copied. If a pulse isn't waiting, the calling thread enters the RECEIVE-blocked state until a pulse arrives.

If multiple pulses are sent to a channel without a thread waiting to receive them, the pulses are queued in priority order.

When a thread receives a pulse:

- The kernel space allocated to hold the pulse is immediately released.
- The memory that pulse points to contains a pulse message of type [struct _pulse](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/_pulse.html "Structure that describes a pulse").
- The thread's effective priority might change. For more information, see “[Priority inheritance and messages](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Priority_inheritance_messages.html)” in the Interprocess Communication (IPC) chapter of the System Architecture guide.

Don't reply to a pulse.

**Blocking states**

STATE_RECEIVE

There's no pulse waiting.

## Returns:

The only difference between MsgReceivePulse() and MsgReceivePulse_r() is the way they indicate errors:

**MsgReceivePulse()** —

If successful, this function returns EOK. If an error occurs, it returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").

**MsgReceivePulse_r()** —

If successful, this function returns EOK. If an error occurs, it may return the negative of any value from the Errors section. This function does **NOT** set errno, even on success.

## Errors:

### `EFAULT`

A fault occurred when the kernel tried to access the buffer provided, or the size of the receive buffer is less than the size of a struct _pulse. The pulse is lost in this case.

### `EINTR`

The call was interrupted by a signal.

### `ESRCH`

The channel indicated by chid doesn't exist.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Message Passing (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html "Message Passing (Getting Started with QNX Neutrino)")

### Related reference  

[MsgDeliverEvent(), MsgDeliverEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html "Deliver an event through a channel")

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivePulsev(), MsgReceivePulsev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulsev.html "Receive a pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgSendPulse(), MsgSendPulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "Send a pulse to a process")

[MsgSendPulsePtr(), MsgSendPulsePtr_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulseptr.html "Send a pulse (containing a pointer) to a process")

[_pulse](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/_pulse.html "Structure that describes a pulse")

[TimerTimeout(), TimerTimeout_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state")
