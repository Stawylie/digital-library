const { Book } = require('../models');

const dummyBooks = [
    {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        genre: 'Classic',
        coverUrl: '/covers/gatsby.jpg',
        description: 'A novel set in the Roaring Twenties...',
        available: true
    },
    {
        title: '1984',
        author: 'George Orwell',
        genre: 'Dystopian',
        coverUrl: '/covers/1984.jpg',
        description: 'A chilling vision of totalitarianism...',
        available: false
    },
    {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        genre: 'Classic',
        coverUrl: '/covers/mockingbird.jpg',
        description: 'A powerful story of racial injustice...',
        available: true
    }
];

(async () => {
    try {
        await Book.bulkCreate(dummyBooks);
        console.log('✅ Dummy books seeded');
    } catch (err) {
        console.error('❌ Error seeding books:', err);
    }
})();