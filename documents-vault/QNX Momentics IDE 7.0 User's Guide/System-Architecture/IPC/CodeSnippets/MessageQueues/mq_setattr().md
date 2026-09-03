---
title: "mq_setattr()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_setattr()
_Set a queue's attributes_

## Synopsis:

```c
#include <mqueue.h>

int mq_setattr( mqd_t mqdes, 
                const struct mq_attr* mqstat,
                struct mq_attr* omqstat );
```

## Arguments:

**mqdes** —

The message-queue descriptor, returned by [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue"), of the message queue that you want to set the attributes of.

**mqstat** —

A pointer to a mq_attr structure that specifies the attributes that you want to use for the message queue. For more information about this structure, see [mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html "Get a message queue's attributes"); for information about which attributes you can set, see below.

**omqstat** —

NULL, or a pointer to a mq_attr structure where the function can store the old attributes of the message queue.

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

The mq_setattr() function sets the mq_flags field for the specified queue (passed as the mq_flags field in mqstat). If omqstat isn't NULL, then the old attribute structure is stored in the location that it points to.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation, and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

This function ignores the mq_maxmsg, mq_msgsize, and mq_curmsgs fields of mqstat. The mq_flags field is the bitwise OR of zero or more of the following constants:

O_NONBLOCK

No [mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue") or [mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "Send a message to a queue") will ever block on this queue. If the queue is in such a condition that the given operation can't be performed without blocking, then an error is returned, and errno is set to EAGAIN.

The settings that you make for mq_flags apply only to the given message-queue description (i.e., locally), not to the queue itself.

## Returns:

-1 if the function couldn't change the attributes ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set). Any other value indicates success.

## Errors:

### `EBADF`

Invalid message queue mqdes.

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

[mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html "Get a message queue's attributes")

[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue")

[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue")

[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "Send a message to a queue")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
