---
title: "mq_getattr()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_getattr()
_Get a message queue's attributes_

## Synopsis:

```c
#include <mqueue.h>

int mq_getattr( mqd_t mqdes,
                struct mq_attr* mqstat );
```

## Arguments:

**mqdes** —

The message-queue descriptor, returned by [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue"), of the message queue that you want to get the attributes of.

**mqstat** —

A pointer to a mq_attr structure where the function can store the attributes of the message queue. For more information, see below.

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

The mq_getattr() function determines the current attributes of the queue referenced by mqdes. These attributes are stored in the location pointed to by mqstat.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation, and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

The fields of the mq_attr structure are as follows:

long mq_flags

The options set for this open message-queue description (i.e., these options are for the given mqdes, not the queue as a whole). This field may have been changed by call to [mq_setattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_setattr.html "Set a queue's attributes") since you opened the queue.

- O_NONBLOCK — no call to [mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue") or [mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "Send a message to a queue") will ever block on this queue. If the queue is in such a condition that the given operation can't be performed without blocking, then an error is returned, and errno is set to EAGAIN.

long mq_maxmsg

The maximum number of messages that can be stored on the queue. This value was set when the queue was created.

long mq_msgsize

The maximum size of each message on the given message queue. This value was also set when the queue was created.

long mq_curmsgs

The number of messages currently on the given queue.

long mq_sendwait

The number of threads currently waiting to send a message. This field was eliminated from the POSIX standard after draft 9, but has been kept as a QNX Neutrino extension. A nonzero value in this field implies that the queue is full.

long mq_recvwait

The number of threads currently waiting to receive a message. Like mq_sendwait, this field has been kept as a QNX Neutrino extension. A nonzero value in this field implies that the queue is empty.

The alternate (mq) implementation of message queues doesn't see the non-POSIX mq_sendwait and mq_recvwait fields.

## Returns:

-1 if an error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set). Any other value indicates success.

## Errors:

### `EBADF`

Invalid message queue mqdes.

## Examples:

See the example for [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html#mq_open__Examples).

## Classification:

[POSIX 1003.1 MSG](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|No|
> |Thread|Yes|

### Related concepts  

[POSIX message queues (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Message_queues.html "POSIX message queues (System Architecture)")

[POSIX Message Queues: Two Implementations (Technotes)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html "POSIX Message Queues: Two Implementations (Technotes)")

### Related reference  

[mq_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_close.html "Close a message queue")

[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue")

[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue")

[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "Send a message to a queue")

[mq_setattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_setattr.html "Set a queue's attributes")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
