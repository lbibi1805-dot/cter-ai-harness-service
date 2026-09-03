---
title: "pthread_key_create()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_key_create()
_Create a thread-specific data key_

## Synopsis:

```c
#include <pthread.h>

int pthread_key_create( pthread_key_t * key,
                        void (*destructor)( void * ) );
```

## Arguments:

**key** —

A pointer to a pthread_key_t object where the function can store the new key.

**destructor** —

NULL, or a function to be called when you destroy the key.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_key_create() function creates a thread-specific data key that's available to all threads in the process and binds an optional destructor function destructor to the key. If the function completes successfully the new key is returned in key.

Although the same key may be used by different threads, the values bound to the key using pthread_setspecific() are maintained on a per-thread basis and persist only for the lifetime of the thread.

When you create a key, the value NULL is bound with the key in all active threads. When you create a thread, the value NULL is bound to all defined keys in the new thread.

You can optionally associate a destructor function with each key value. At thread exit, if the key has a non-NULL destructor pointer, and the thread has a non-NULL value bound to the key, the destructor function is called with the bound value as its only argument. The order of destructor calls is undefined if more than one destructor exists for a thread when it exits.

If, after all destructor functions have been called for a thread, there are still non-NULL bound values, the destructor function is called repeatedly a maximum of PTHREAD_DESTRUCTOR_ITERATIONS times for each non-NULL bound value.

## Returns:

### `EOK`

Success.

### `EAGAIN`

Insufficient system resources to create key, or PTHREAD_KEYS_MAX has been exceeded.

### `ENOMEM`

Insufficient memory to create key.

## Examples:

This example shows how you can use thread-specific data to provide per-thread data in a thread-safe function:

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>

pthread_key_t buffer_key;

void buffer_key_destruct( void *value )
{
    free( value );
    pthread_setspecific( buffer_key, NULL );
}

char *lookup( void )
{
    char *string;

    string = (char *)pthread_getspecific( buffer_key );
    if( string == NULL ) {
        string = (char *) malloc( 32 );
        sprintf( string, "This is thread %d\n", pthread_self() );      
        pthread_setspecific( buffer_key, (void *)string );
    }

    return( string );
}

void *function( void *arg )
{
    while( 1 ) {
        puts( lookup() );
    }

    return( 0 );
}

int main( void )
{
    pthread_key_create( &buffer_key,
                        &buffer_key_destruct );
    pthread_create( NULL, NULL, &function, NULL );

    /* Let the threads run for 60 seconds. */
    sleep( 60 );
    
    return EXIT_SUCCESS;
}
```

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

Before each destructor is called, the thread's value for the corresponding key is set to NULL. Calling:

pthread_setspecific( key, NULL );

in a key destructor isn't required; this lets you use the same destructor for several keys.

### Related reference  

[pthread_getspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getspecific.html "Get a thread-specific data value")

[pthread_setspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setspecific.html "Set a thread-specific data value")

[pthread_key_delete()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_delete.html "Delete a thread-specific data key")
