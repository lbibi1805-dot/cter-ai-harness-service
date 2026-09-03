---
title: "Unit Testing"
category: "QNX-TESTING"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, testing, qnx-testing, unit-test]
---

# Unit Testing

The IDE lets you use commercial test frameworks to write unit tests and then execute them by launching a project. While running a test program, you can use the Code Coverage tool to determine how much of the code is exercised (covered) by your tests.

The IDE supports these test frameworks:

- [Boost.Test Library](http://www.boost.org/doc/libs/1_42_0/libs/test/doc/html/utf.html)
- [Google C++ Testing Framework](https://github.com/google/googletest/blob/master/googletest/docs/primer.md)
- [Qt4 Testing Framework](http://doc.qt.io/qt-5/qttest-index.html)

This release of QNX SDP includes the Google C++ Testing Framework and the IDE is configured to work with it. You can therefore write test programs based on the Google framework without any extra setup. With the other two test frameworks, the IDE can parse the results of their test programs but you must unpackage and compile these frameworks on your host and manually configure the IDE to use them.

When you run a test program based on any of these frameworks, the IDE visually presents the test results. The integrated Code Coverage tool lets you measure the quality of your tests by reporting which areas of code they exercise. Thus, you can find and fix bugs in your code and limitations in your test programs in a single run-edit-compile cycle.

- **[Writing and building test programs](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/writing_test_programs.html)**  
    The test frameworks supported by the IDE let you write programs in C++ that test C or C++ code. Here, we explain the QNX project setup required to write a test program using the Google C++ Testing (GTest) Framework. For the other frameworks, you should read their online documentation to learn the coding and building steps needed to write test programs.
- **[Running test programs](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/running_test_programs.html)**  
    You can launch a unit test program on the target and the IDE will display the results of individual tests in a dedicated view as the program runs.
- **[Measuring code coverage](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/measuring_code_coverage.html)**  
    You can build and configure projects in the IDE to collect and display code coverage measurements as the program runs.
- **[Importing Code Coverage results](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/importing_coverage_results.html)**  
    If you have coverage data generated outside of the IDE, you can import that data and view the results.
- **[Exporting Code Coverage results](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/exporting_coverage_results.html)**  
    Sometimes, it's useful to view coverage data outside of the IDE. The Code Coverage export feature lets you generate a report that contains the data of a coverage session and that can be viewed in a browser.
