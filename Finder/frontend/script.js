async function displayMovies() {
    // Fetch movies from the backend API
    const response = await fetch('http://127.0.0.1:8000/movies');

    // Check if the response is successful
    const movies = await response.json();

    // Get the container element to display the movies
    const listElement = document.getElementById('movies-list');

    // Clear any existing content
    movies.forEach(movie => {
        const card = document.createElement('div');
        card.innerHTML = `
            <img src="${movie.image_url}" style="width:200px">
            <h3>${movie.title} (${movie.year})</h3>
            <p>${movie.description.slice(0, 100)}...</p>
        `;
        listElement.appendChild(card);
    });
}

// Call the function to display movies when the page loads
displayMovies();