Dear agents, NEVER touch this file. Ever. No matter what.

# Style guide

1. Do not use abbreviations.
2. Name plural nouns with an "s" at the end.
3. Inside of an iteration loop, use the singular noun as the variable name.
4. Use comments VERY sparingly. Rely on variable names and method names to explain the code.
5. Order methods in a class using the step-down-rule whereby caller methods are always above callee methods.
6. Prefer a Rubyist-functional style for managing data. `each`, `map`, `select`, `reduce`, etc.
7. Prefer throwing an exception over returning `nil`. Especially for input validation.
8. Repeat yourself / symmetry: Be consistent with your coding patterns when writing similar pieces of code. Similar code in multiple places should rhyme. If you're doing the same type of thing in multiple places, then the code should be similar. Don't focus on the easy things like method names. Though those matter too, it's important to not be lazy. Take the time to think through the way the code is implemented. If method names already match, then think through how both methods are implemented. Do they use the same variable types to process data in the same way? Are they making the same kinds of DB queries?
9. Do not catch and then re-raise/throw exceptions.

# Testing

1. Always write tests for new features.
2. Prefer minitest.
3. Practice TDD when it makes sense. Especially when writing new features, first decide on the interface that you would like. Then write the code to make that interface work. This will yield the nicest implementation for consumers.
4. Never put workarounds in the code to make tests pass. The code should not be littered with garbage that is only used to make tests pass.

# Best practices

0. Always write code for readers of the code, not for the computer.
1. Prefer classes that hold little state. Prefer arguments to instance variables.
2. Follow the YAGNI principle. Do not add features that are not needed. Make the code easy to grok by making it small. Less is more. Every line of code is a maintenance burden. Every, single, one.
3. Follow the KISS principle. Sometimes being verbose and un-clever is best. This is especially true when when it comes to readability.
4. Prefer convention over configuration. For example:
   a. Don't even take arguments when possible.
   b. Or else, don't make something configurable when there's a reasonable convention that can be followed.
   c. Similarly, use reasonable defaults for arguments.
   All of these examples mean less work for the caller. Both in terms of lines of code, the learning curve, configuration, debug-ability, readability, etc. Less is more.
5. Always do the work so that the caller doesn't have to. If it's possible to find the value of something without the caller needing to specify it, then do that. Don't always think about efficiency.
6. Always think of ways to do less. Fewer options, less configurable.
7. Always clean up old or unused code.
8. Never leave tombstones for deleted code.
9. Don't log excessively. Most logging is not needed.
10. Just because you found it that way doesn't mean it's the best way. Be brave to establish new conventions or break old ones. This is not just about the simple refactorings like de-duplicating code. That's small potatoes. This is about the bigger picture of writing the best code possible.
12. Be quick to create new classes. They're one of the most important tools that you have to organize code. Be generous with your use of classes. You'll often find that you didn't realize how helpful having a class for a concept is until you have it.

# SQL

1. Do not alias tables unless absolutely necessary. They do not help readability.
2. Do not alias columns unless absolutely necessary.

# Ruby

1. Prefer fewer gems. Similar to lines of code, every gem is a maintenance burden. This is a preference, not a rule against Gems. The right gem can save A LOT of time. Just be considerate when adding gems.

# Rails

1. Always prefer ActiveRecord over raw SQL.

# Rake

1. Prefer arguments over environment variables.