---
title: "pthread_setspecific()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_setspecific()
_Set a thread-specific data value_

## Synopsis:

```c
#include <pthread.h>

int pthread_setspecific( pthread_key_t key,
                         const void* value );
```

## Arguments:

**key** —

The key associated with the data that you want to set. See [pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html "Create a thread-specific data key").

**value** —

The value that you want to store.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_setspecific() function binds the thread specific data value value with the thread specific data key key.

You can call this function from within a thread-specific data destructor function.

You must call this function with a key that you got from pthread_key_create(). You can't use a key after destroying it with [pthread_key_delete()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_delete.html "Delete a thread-specific data key").

## Returns:

### `EOK`

Success.

### `ENOMEM`

Insufficient memory to store thread specific data value value.

### `EINVAL`

Invalid thread specific data key key.

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
> |Signal handler|No|
> |Thread|Yes|

## Caveats:

Calling pthread_setspecific() with a non-NULL value may result in lost storage or infinite loops unless value was returned by pthread_key_create().

### Related reference  

[pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html "Create a thread-specific data key")

[pthread_getspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getspecific.html "Get a thread-specific data value")
