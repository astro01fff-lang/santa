import asyncio
from amqtt.broker import Broker
cfg={'listeners':{'default':{'type':'ws','bind':'127.0.0.1:9001','max_connections':50}},'auth':{'allow-anonymous':True,'plugins':['auth_anonymous']},'topic-check':{'enabled':False}}
async def main():
  b=Broker(cfg);await b.start();await asyncio.Event().wait()
asyncio.run(main())
