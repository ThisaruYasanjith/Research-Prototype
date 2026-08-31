# External Java Test Data Attribution

## Source Repository

Repository:
iluwatar/java-design-patterns

Source URL:
https://github.com/iluwatar/java-design-patterns

Upstream commit used:
41625d8d354cdf6b6f10a82e29c2392b3efd5d20

Commit date:
2026-08-30

License:
MIT License

The original license file is included as LICENSE.md.
The copied Java source files retain their original copyright
and license notices.

## Purpose

These Java source files are used as external academic test
inputs for the Code Cleanliness & Maintainability Triage
prototype.

They are not code developed by this research project and are
not presented as original implementation work.

The source repository was selected because the
java-design-patterns repository was used as the subject system
in a peer-reviewed static code analysis study reviewed during
the literature investigation.

## Selected Test Files

1. commander/src/main/java/com/iluwatar/commander/Commander.java
   Prototype use:
   Class-size, method-size and complexity analysis.

2. caching/src/main/java/com/iluwatar/caching/CacheStore.java
   Prototype use:
   Method metrics and duplicated-logic candidate analysis.

3. caching/src/main/java/com/iluwatar/caching/LruCache.java
   Prototype use:
   Class-level and method-level maintainability measurements.

4. transaction-script/src/main/java/com/iluwatar/transactionscript/HotelDaoImpl.java
   Prototype use:
   Method metrics, branching and maintainability analysis.

5. property/src/main/java/com/iluwatar/property/App.java
   Prototype use:
   Comparison input from a module reported in the reviewed study.

## Research Reference

K. Aldi et al.,
"Multi-Tool Static Code Analysis for Code Smell and Bug
Detection: A Case Study on the java-design-patterns Repository,"
ICITRI, 2025.

## Usage Note

The selected files are used unchanged as external test inputs.
No maintainability problems were intentionally inserted into
the source code to force analyzer detections.

Analyzer findings are treated as prototype analysis results
and not automatically as validated ground truth.
