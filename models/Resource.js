module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Resource', {
        title: DataTypes.STRING,
        author: DataTypes.STRING,
        year: DataTypes.INTEGER,
        type: DataTypes.STRING,
        subject: DataTypes.STRING,
        url: DataTypes.STRING
    });
};