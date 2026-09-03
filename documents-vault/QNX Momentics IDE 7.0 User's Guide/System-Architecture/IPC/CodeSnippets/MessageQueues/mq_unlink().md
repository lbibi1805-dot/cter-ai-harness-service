---
title: "mq_unlink()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_unlink()
_Remove a queue_

## Synopsis:

```c
#include <mqueue.h>

int mq_unlink( const char* name );
```

## Arguments:

**name** —

The name of the message queue that you want to unlink.

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

The mq_unlink() function removes the queue with the given name.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation, and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

If some process has the queue open when the call to mq_unlink() is made, then the actual deletion of the queue is postponed until it has been closed. If a queue exists in the netherworld between unlinking and the actual removal of the queue, then _all_ calls to open a queue with the given name fail (even if O_CREAT is present in oflag). Once the queue is deleted, all elements currently on it are freed. Due to the lazy deletion of queues, it's impossible for any process to be blocked on the message queue when it's deleted.

Calling [unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/u/unlink.html "Remove a link to a file") with a name that resolves to the message queue server's namespace (e.g., /dev/mqueue/my_queue) is analogous to calling mq_unlink() with name set to the last elements of the pathname (e.g., my_queue).

## Returns:

-1 if the queue wasn't successfully unlinked ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set). Any other value indicates that the queue was successfully unlinked.

## Errors:

### `EACCES`

You don't have permission to unlink the specified queue.

### `ELOOP`

Too many levels of symbolic links or prefixes.

### `ENAMETOOLONG`

The length of name exceeds PATH_MAX.

### `ENOENT`

The queue name doesn't exist.

### `ENOSYS`

The mq_unlink() function isn't implemented for the filesystem specified in name, or the message queue manager ([mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) or [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html)) isn't running.

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

[unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/u/unlink.html "Remove a link to a file")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
