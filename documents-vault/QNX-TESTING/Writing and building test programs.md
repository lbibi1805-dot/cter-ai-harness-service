---
title: "Writing and building test programs"
category: "QNX-TESTING"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, testing, qnx-testing]
---

# Writing and building test programs

The test frameworks supported by the IDE let you write programs in C++ that test C or C++ code. Here, we explain the QNX project setup required to write a test program using the Google C++ Testing (GTest) Framework. For the other frameworks, you should read their online documentation to learn the coding and building steps needed to write test programs.

The code being tested can belong to an application or a library.

To write and build a test program based on the GTest framework:

1. In the project that contains the code that you want to run unit tests on, create the additional source files and write the code necessary for the test cases.
    
    The [online GTest documentation](https://github.com/google/googletest/blob/master/googletest/docs/primer.md) explains the GTest framework concepts and how to write a test program, starting from individual assertions and working towards a complete program with many test cases. Here, we list a few of the key steps for writing test programs:
    
    - Store the test program files in a specific project folder (e.g., test), to keep them separate from the main program, for ease of maintenance.
    - In the header file for your test program, you must include the GTest header file, as follows:
```c
#include <gtest/gtest.h>
```
- In your test program's source files, you must include any header files declaring the functions that you want to test. This is because the test macros must be able to see the prototypes of the functions that they're testing.
    - In the GTest framework, individual tests are grouped into test cases. We recommend putting each test case in its own source file, to keep together all of the tests that exercise a specific program area. If you're using test fixtures to share data between tests, each source file will define an individual class, in which you can implement routines that prepare the data before the tests defined in the same file get run, and that release any resources used by the tests after they finish running.
    - You must call `RUN_ALL_TESTS()` exactly once in the program (in the main() function), even if your test cases are defined in multiple files.
    
2. Modify your makefile to statically link the GTest library.
    
    Although the installer from this latest SDP release includes the GTest library (libgtest.so), you must still [add the library to your project](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/adding_libraries.html "Our sample application doesn't use libraries but if you want to build an application that does, you need to link those libraries to your application. The way you do this in the IDE depends on the type of makefile you're using.").
    
    If you're building your programs with an older SDP version, we don't recommend trying to use the GTest library shipped with this latest SDP release to develop unit test programs. This would be complicated because you might have to modify the GTest library to compile properly and/or acquire other libraries needed by GTest but not shipped with the platform version that you're building with.
    
3. Click the Build button (![Icon: Build button](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/images/icons/build.png)).

The IDE attempts to build the test program and displays the build output in the Console window at the bottom. If the build succeeds, you'll see the binary files listed in the project area in the Project Explorer. If the build fails, the Problems window shows any errors (in red) and warnings (in yellow).
