---
title: "close()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# close()
_Close a file_
## Synopsis:

```c
#include <unistd.h>

int close( int filedes );
```

## Arguments:

**filedes** —

The file descriptor of the file you want to close. This can be a file descriptor returned by a successful call to [accept()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/accept.html "Accept a connection on a socket"), [creat()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/creat.html "Create and open a file (low-level)"), [dup()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup.html "Duplicate a file descriptor"), [dup2()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup2.html "Duplicate a file descriptor, specifying the new descriptor"), [fcntl()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/fcntl.html "Provide control over an open file"), [modem_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/modem_open.html "Open a serial port"), [open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/o/open.html "Open a file"), [shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object"), [socket()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/socket.html "Create an endpoint for communication") or [sopen()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sopen.html "Open a file for shared access").

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The close() function closes the file specified by the given file descriptor.

## Returns:

Zero for success, or -1 if an error occurs ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EBADF`

Invalid file descriptor filedes.

### `EINTR`

The close() call was interrupted by a signal. In the QNX Neutrino implementation, the file descriptor remains open.

### `EIO`

An I/O error occurred while updating the directory information.

### `ENOSPC`

A previous buffered write call has failed.

### `ENOSYS`

The close() function isn't implemented for the filesystem specified by filedes.

## Examples:

```c
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>

int main( void )
{
    int filedes;

    filedes = open( "file", O_RDONLY );
    if( filedes != -1 ) {
        /* process file */
        close( filedes );

        return EXIT_SUCCESS;
    }

    return EXIT_FAILURE;
}
```

## Classification:

[POSIX 1003.1](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related reference  

[accept()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/accept.html "Accept a connection on a socket")

[creat(), creat64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/creat.html "Create and open a file (low-level)")

[dup()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup.html "Duplicate a file descriptor")

[dup2()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup2.html "Duplicate a file descriptor, specifying the new descriptor")

[errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable")

[fcntl()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/fcntl.html "Provide control over an open file")

[modem_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/modem_open.html "Open a serial port")

[open(), open64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/o/open.html "Open a file")

[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object")

[socket()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/socket.html "Create an endpoint for communication")

[sopen()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sopen.html "Open a file for shared access")
