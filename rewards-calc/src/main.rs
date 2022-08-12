use dotenv;
use std::collections::HashMap;
use std::error::Error;
use std::fmt;
mod structs;
use structs::{EscrowValue, EscrowTimeKey};
use crate::structs::History;

mod query_couch;

use query_couch::query_couch_db;

//aaa {"results":[
//{"total_rows":305541,"offset":71,"rows":[
//    {"id":"223ET2ZAGP4OGOGBSIJL7EF5QTVZ2TRP2D4KMGZ27DBFTIJHHXJH44R5OE","key":"223ET2ZAGP4OGOGBSIJL7EF5QTVZ2TRP2D4KMGZ27DBFTIJHHXJH44R5OE","value":{

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenv::from_filename(".env").expect(".env file can't be found!");
    let result = dotenv::vars().fold(HashMap::new(), |mut map, val| {
        map.insert(val.0, val.1);
        map
    });
    // println!("{:?}", result.get("ALGORAND_NETWORK").take());

    let couch_dburl = result.get("COUCHDB_BASE_URL").expect("Missing COUCHDB_BASE_URL");
    let keys = [String::from("1")].to_vec();
    let formatted_escrow_epochs = query_couch_db::<String>(&couch_dburl,
        &"formatted_escrow".to_string(),
        &"formatted_escrow".to_string(),
        &"epochs".to_string(), &keys).await;
    let resultRows = &formatted_escrow_epochs.unwrap().results[0].rows;
    let escrowAddrs:Vec<String> = resultRows.iter().map(|row| String::clone(&row.value)).collect();
    //println!("{:?}", escrowAddrs);
    
    let formatted_escrow_data = query_couch_db::<EscrowValue>(&couch_dburl,
        &"formatted_escrow".to_string(),
        &"formatted_escrow".to_string(),
        &"orderLookup".to_string(), &escrowAddrs).await;

    let firstResultRows = &formatted_escrow_data.unwrap().results[0].rows;

    let escrows: Vec<&EscrowValue> = firstResultRows.iter().map(|row| &row.value).collect();
    let escrowAddrToData:HashMap<&String,&EscrowValue> = firstResultRows.iter().fold(HashMap::new(), |mut map, row| {
            map.insert(&row.id, &row.value);
            map
        });
    //println!("{:?}", escrowAddrToData);

    let ownerWallets = escrows.iter().map(|escrow| &escrow.data.escrow_info.owner_addr);


    let formatted_escrow_data = query_couch_db::<EscrowValue>(&couch_dburl,
        &"formatted_escrow".to_string(),
        &"formatted_escrow".to_string(),
        &"orderLookup".to_string(), &escrowAddrs).await;

    let (unixTimeToChangedEscrows, unixTimes) = getSequenceInfo(&escrows);

    let escrowTimeToBalance = getEscrowAndTimeToBalance(&escrows);
    dbg!(escrowTimeToBalance);
    Ok(())
}

/*
const getEscrowAndTimeToBalance = escrows => {
    const escrowTimeMap = escrows.reduce( (escrowTimeMap, escrow) => {
      escrow.data.history.forEach(historyItem => {
        const time = historyItem.time;
        const balance = escrow.data.escrowInfo.isAlgoBuyEscrow ?
          historyItem.algoAmount : historyItem.asaAmount;
        const key = escrow._id+':'+time;
        escrowTimeMap[key] = balance;
      });
      return escrowTimeMap;
    }, {});
    return escrowTimeMap;
  };
*/


fn getEscrowAndTimeToBalance(escrows: &Vec<&EscrowValue>) -> HashMap<EscrowTimeKey,u64> {
    let escrowTimeMap: HashMap<EscrowTimeKey,u64> = escrows.iter().fold(HashMap::new(), |mut escrowTimeMap, escrow| {
        escrow.data.history.iter().for_each(|historyItem| {
            let time = historyItem.time;
            let balance = match escrow.data.escrow_info.is_algo_buy_escrow {
                true => historyItem.algo_amount,
                false => historyItem.asa_amount
            };
            let key = EscrowTimeKey{escrow: escrow.id.clone(), unix_time: time};
            escrowTimeMap.insert(key, balance.unwrap());
        });
        escrowTimeMap
    });

    escrowTimeMap
}
fn getSequenceInfo(escrows: &Vec<&EscrowValue>) -> (HashMap<u32, Vec<String>>,Vec<u32>) {
    let unixTimeToChangedEscrows: HashMap<u32, Vec<String>> =
        escrows.iter().fold(HashMap::new(), |mut timeline, escrow| {
            let times: Vec<u32> = escrow.data.history.iter().map(|historyItem| historyItem.time).collect();
            times.iter().for_each(|time| {
                if (!timeline.contains_key(time)) {
                    timeline.insert(time.clone(), Vec::new());
                }
                let mut addrArr = timeline.get_mut(time).unwrap();
                addrArr.push(escrow.id.clone());
            });
            timeline
        });

    let unixTimes = unixTimeToChangedEscrows.keys().cloned().collect();

    return (unixTimeToChangedEscrows, unixTimes);
}

// const getSequenceInfo = escrows => {
//     const unixTimeToChangedEscrows = escrows.reduce( (timeline, escrow) => {
//       const times = escrow.data.history.map(historyItem => historyItem.time);
//       times.forEach( time => {
//         const key = 'ts:'+time;
//         if (!(key in timeline)) {
//           timeline[key] = [];
//         }
//         const addrArr = timeline[key];
//         addrArr.push(escrow._id); // push escrow address
//       });
//       return timeline;
//     }, {});
  
//     const changedEscrowSeq = Object.keys(unixTimeToChangedEscrows)
//         .map(key => parseInt(key.split(':')[1]));
//     changedEscrowSeq.sort();
  
//     return {unixTimeToChangedEscrows, changedEscrowSeq};
//   };

  