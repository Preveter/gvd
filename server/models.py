import peewee

db = peewee.SqliteDatabase("db/gvd.db")
db.connect()


class User(peewee.Model):
    god_name = peewee.FixedCharField(index=True, primary_key=True, max_length=30)
    password = peewee.CharField(null=True, max_length=255)
    motto_login = peewee.CharField(null=True, max_length=30)

    class Meta:
        database = db


class Session(peewee.Model):
    sid = peewee.FixedCharField(index=True, primary_key=True, max_length=32)
    god = peewee.ForeignKeyField(User, related_name='sessions')
    last_connect = peewee.DateTimeField(null=True)
    last_address = peewee.CharField(null=True, max_length=255)

    class Meta:
        database = db


# db.create_table(User)
# db.create_table(Session)
