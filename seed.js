const { sequelize, Book, Resource } = require('./models');

async function seed() {
    await sequelize.sync({ force: true }); // Wipes and recreates tables

    await Book.bulkCreate([
        {
            title: 'Clean Code',
            author: 'Robert C. Martin',
            genre: 'Software Engineering',
            coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/41xShlnTZTL._SX374_BO1,204,203,200_.jpg',
            description: 'A handbook of agile software craftsmanship.',
            available: true
        },
        {
            title: 'The Pragmatic Programmer',
            author: 'Andy Hunt & Dave Thomas',
            genre: 'Programming',
            coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/51WfLhZLZ0L._SX376_BO1,204,203,200_.jpg',
            description: 'Tips and techniques for effective programming.',
            available: true
        }
    ]);

    await Resource.bulkCreate([
        {
            title: 'JavaScript Essentials',
            author: 'Mozilla Docs',
            year: 2022,
            type: 'Article',
            subject: 'JavaScript',
            url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript'
        },
        {
            title: 'PostgreSQL Tutorial',
            author: 'Postgres Team',
            year: 2023,
            type: 'Guide',
            subject: 'Databases',
            url: 'https://www.postgresql.org/docs/'
        }
    ]);

    console.log('✅ Seeded books and resources');
    process.exit();
}

seed();