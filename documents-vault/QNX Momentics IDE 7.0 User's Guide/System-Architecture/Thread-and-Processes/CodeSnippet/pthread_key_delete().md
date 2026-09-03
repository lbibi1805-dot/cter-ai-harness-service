---
title: "pthread_key_delete()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_key_delete()
_Delete a thread-specific data key_

## Synopsis:

```c
#include <pthread.h>

int pthread_key_delete( pthread_key_t key );
```

## Arguments:

**key** —

The key, which you created by calling [pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html "Create a thread-specific data key"), that you want to delete.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_key_delete() function deletes the thread-specific data key key that you previously created with pthread_key_create(). The destructor function bound to key isn't called by this function, and won't be called at thread termination. You can call this function from a thread specific data destructor function.

If you need to release any data bound to the key in any threads, do so before deleting the key.

## Returns:

### `EOK`

Success.

### `EINVAL`

Invalid thread-specific data key key.

## Classification:

[POSIX 1003.1](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related reference  

[pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html "Create a thread-specific data key")
