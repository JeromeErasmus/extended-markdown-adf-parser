# Edge Cases & Complex Scenarios <!-- adf:heading attrs='{"customId":"main-heading","anchor":true}' -->

Text with <span style="color: #FF5630">***multiple***</span> overlapping marks and `special chars: <>&"'`.

| Merged Header <!-- colspan=2 --><!-- adf:tableHeader attrs='{"rowspan":1,"colwidth":[150,200]}' --> | Single |
| -------- | -------- | -------- |
| Cell with<br>multiple<br>lines | - Nested list in cell | ```json<br>{<br>  "nested": "code in cell"<br>}<br>``` |
| a\|b | c | d |
<!-- adf:table attrs='{"isNumberColumnEnabled":true,"layout":"full-width"}' -->

````js
a
```
b
````

~~~panel type=warning attrs='{"customData":"test-value","priority":1}'
Warning panel with custom attributes and <u>~~empty~~</u> marks.
~~~

5. List starting at 5

   - Nested bullet item
6. 
7. Item after empty

## Whitespace Resilience Test

This section tests multiple line breaks between elements.

Multiple empty lines above and below this paragraph.

- List item 1
- List item 2 with extra spacing

> Blockquote with excessive whitespace around it

Final paragraph with trailing spaces and multiple breaks.

## Checkbox Task List Edge Cases

- [x] Done item
- Regular item without checkbox
- [ ] Todo item
- [x] Parent task with nested content

  - Nested bullet item
- [ ] Simple sibling task