module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Notification', {
        message: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        read: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    });
};