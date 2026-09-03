---
title: "Pipes and FIFOs"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Pipes and FIFOs

Pipes and FIFOs are both forms of queues that connect processes.

In order for you to use pipes or FIFOs in the QNX Neutrino RTOS, the pipe resource manager ([pipe](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/pipe.html)) must be running.

Pipes

A _pipe_ is an unnamed file that serves as an I/O channel between two or more cooperating processes: one process writes into the pipe, the other reads from the pipe.

The pipe manager takes care of buffering the data. The buffer size is defined as PIPE_BUF in the <limits.h> file. A pipe is removed once both of its ends have closed. The function [pathconf()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pathconf.html) returns the value of the limit.

Pipes are normally used when two processes want to run in parallel, with data moving from one process to the other in a single direction. (If bidirectional communication is required, messages should be used instead.)

A typical application for a pipe is connecting the output of one program to the input of another program. This connection is often made by the shell. For example:

ls | more
  

directs the standard output from the ls utility through a pipe to the standard input of the more utility.

|If you want to:|Use the:|
|---|---|
|Create pipes from within the shell|pipe symbol (“\|”)|
|Create pipes from within programs|[pipe()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pipe.html) or [popen()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/popen.html) functions|

FIFOs

FIFOs are essentially the same as pipes, except that FIFOs are named permanent files that are stored in filesystem directories.

|If you want to:|Use the:|
|---|---|
|Create FIFOs from within the shell|[mkfifo](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mkfifo.html) utility|
|Create FIFOs from within programs|[mkfifo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mkfifo.html) function|
|Remove FIFOs from within the shell|[rm](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/r/rm.html) utility|
|Remove FIFOs from within programs|[remove()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/r/remove.html) or [unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/u/unlink.html) function|

### Related reference  

[pipe](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/pipe.html "pipe")
