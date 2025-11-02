module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Book', {
        title: DataTypes.STRING,
        author: DataTypes.STRING,
        genre: DataTypes.STRING,
        coverUrl: DataTypes.STRING,
        description: DataTypes.TEXT,
        available: DataTypes.BOOLEAN
    });
};