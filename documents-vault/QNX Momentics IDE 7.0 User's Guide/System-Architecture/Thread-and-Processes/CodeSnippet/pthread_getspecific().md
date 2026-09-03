---
title: "pthread_getspecific()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_getspecific()
_Get a thread-specific data value_

## Synopsis:

```c
#include <pthread.h>

void* pthread_getspecific( pthread_key_t key );
```

## Arguments:

**key** —

The key associated with the data that you want to get. See [pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html "Create a thread-specific data key").

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_getspecific() function returns the thread-specific data value currently bound to the thread-specific-data key key in the calling thread, or NULL if no value is bound or the key doesn't exist. You can call this function from a thread-specific-data destructor function.

You must call this function with a key that you got from pthread_key_create(). You can't use a key after destroying it with [pthread_key_delete()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_delete.html "Delete a thread-specific data key").

## Returns:

The data value, or NULL.

## Examples:

See [pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html "Create a thread-specific data key").

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

[pthread_key_delete()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_delete.html "Delete a thread-specific data key")

[pthread_setspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setspecific.html "Set a thread-specific data value")
