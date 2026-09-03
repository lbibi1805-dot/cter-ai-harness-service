---
title: "pthread_attr_setscope()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_setscope()
_Set the thread contention scope attribute_

## Synopsis:

```c
#include <pthread.h>

int pthread_attr_setscope( pthread_attr_t* attr,
                           int scope );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that defines the attributes to use when creating new threads. For more information, see [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object").

**scope** —

The new value for the contention scope attribute. This value must be:

- PTHREAD_SCOPE_SYSTEM — schedule all threads together.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_setscope() function sets the thread contention scope attribute in the thread attribute object attr to scope.

## Returns:

### `EOK`

Success.

### `EINVAL`

Invalid thread contention scope attribute scope with a value other than PTHREAD_SCOPE_PROCESS.

### `ENOTSUP`

Invalid thread contention scope attribute scope with the value PTHREAD_SCOPE_PROCESS.

## Classification:

[POSIX 1003.1 TPS](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Processes and Threads (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs.html "Processes and Threads (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_attr_getscope()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getscope.html "Get the thread contention scope attribute")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")
