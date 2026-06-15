const User = require('./src/models/User');
const { EVENTS, fireEvent } = require('./src/events/notificationEvents');

async function testAdmin () {
    const admin = await User.getAdminUser();
    await fireEvent(EVENTS.NEW_KYB_REQUEST, admin.id, { businessName: "xx33" });
}

testAdmin();