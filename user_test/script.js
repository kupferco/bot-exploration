// JavaScript code to add content dynamically
document.addEventListener('DOMContentLoaded', function() {
    // Create a new paragraph element
    const newParagraph = document.createElement('p');
    newParagraph.textContent = 'This content was added dynamically using JavaScript!';

    // Append the new paragraph to the container
    const container = document.getElementById('container');
    container.appendChild(newParagraph);

    // Add a button that changes the text content when clicked
    const button = document.createElement('button');
    button.textContent = 'Click Me!';
    container.appendChild(button);

    // Change text content on button click
    button.addEventListener('click', function() {
        newParagraph.textContent = 'The content was updated after clicking the button!';
    });
});
