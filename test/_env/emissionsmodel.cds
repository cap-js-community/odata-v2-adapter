namespace userData;

entity PREFERENCES {
   key USER_ID : String(64);
   key TYPE : String(32);
   key LOCATION : String(32);
   key NAME : String(32);
   VALUE : String(256);
};

service EmissionsCalculatorService {

    entity UserPreferences as select from userData.PREFERENCES { TYPE, LOCATION, NAME, VALUE } /*where USER_ID = $user.id*/;
    // entity UserPreferences as select from userData.PREFERENCES { key TYPE, key LOCATION, key NAME, VALUE } /*where USER_ID = $user.id*/;
}
