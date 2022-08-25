use dotenv;
use core::panic;
use std::collections::HashMap;
use urlencoding::encode;
use reqwest;
use serde::{Serialize, Deserialize};
use serde::de::DeserializeOwned;
use serde_json;
use serde_path_to_error;
use std::error::Error;

use crate::structs::{CouchDBOuterResp, Keys, Queries, EscrowValue};
use crate::structs::CouchDBResp;
use crate::structs::CouchDBOuterResp2;

// This is used for debugging since optionals dont work with serde json debugger
// pub async fn query_couch_db2<T: DeserializeOwned>(couch_url: &String, db_name: &String, index_name: &String, 
//   view_name: &String, keys: &Vec<String>, group: bool)
//   -> Result<(CouchDBOuterResp2<T>), Box<dyn Error>> 
//   {

//   let client = reqwest::Client::new();

//   let keys = Keys {
//       keys: keys.clone(),
//       group
//   };
//   let mut keysVec: Vec<Keys> = Vec::new();
//   keysVec.push(keys);

//   let queries = Queries {
//       queries: keysVec,
//   };

// //   let keysStr = serde_json::to_string(&queries).unwrap();
//   //println!("bbb {}",keysStr);
//   // let jsonObj = serde_json::from_str(json).unwrap();
//   //let query = serde_json::to
//   //let query_encoded = encode(query.as_str());

// //   println!("{}", keysStr);
//   let full = format!("{}/{}/_design/{}/_view/{}/queries",
//       couch_url, db_name, index_name, view_name);

//   let resp = client.post(full)
//       //.header(reqwest::header::CONTENT_TYPE, "application/json")
//       .json(&queries)
//       .send()
//       .await?;

//   let res = resp.text().await?;
//   //let owned = res.to_owned();
//   //let text: &'a String = &owned;
// //   println!("aaa {}",&res[0..1000]);
//   if (res.contains("\"error\":\"unauthorized\"")) {
//     panic!("{res}");
//   }

//   let result: Result<CouchDBOuterResp2<T>,_> = serde_json::from_str(&res);

//   if let Err(_) = &result {
//     println!("{res}");
//     let jd = &mut serde_json::Deserializer::from_str(&res);
//     let result2: Result<CouchDBOuterResp2<T>, _> = serde_path_to_error::deserialize(jd);
//     match &result2 {
//         Ok(_) => {},
//         Err(err) => {
//             let path = err.path().to_string();
//             dbg!(path);
//         }
//     }
//   };

//   //return Err("Error...".into());
//   return Ok(result?);
// }


pub async fn query_couch_db<T: DeserializeOwned>(couch_url: &String, db_name: &String, index_name: &String, 
  view_name: &String, keys: &Vec<String>, group: bool)
  -> Result<(CouchDBOuterResp<T>), Box<dyn Error>> 
  {

  let client = reqwest::Client::new();

  let keys = Keys {
      keys: keys.clone(),
      group
  };
  let mut keysVec: Vec<Keys> = Vec::new();
  keysVec.push(keys);

  let queries = Queries {
      queries: keysVec,
  };

//   let keysStr = serde_json::to_string(&queries).unwrap();
  //println!("bbb {}",keysStr);
  // let jsonObj = serde_json::from_str(json).unwrap();
  //let query = serde_json::to
  //let query_encoded = encode(query.as_str());

//   println!("{}", keysStr);
  let full = format!("{}/{}/_design/{}/_view/{}/queries",
      couch_url, db_name, index_name, view_name);

  let resp = client.post(full)
      //.header(reqwest::header::CONTENT_TYPE, "application/json")
      .json(&queries)
      .send()
      .await?;

  let res = resp.text().await?;
  //let owned = res.to_owned();
  //let text: &'a String = &owned;
//   println!("aaa {}",&res[0..1000]);
  if (res.contains("\"error\":\"unauthorized\"")) {
    panic!("{res}");
  }

  let result: Result<CouchDBOuterResp<T>,_> = serde_json::from_str(&res);

  if let Err(_) = &result {
    println!("{res}");
    let jd = &mut serde_json::Deserializer::from_str(&res);
    let result2: Result<CouchDBOuterResp<T>, _> = serde_path_to_error::deserialize(jd);
    match &result2 {
        Ok(_) => {},
        Err(err) => {
            let path = err.path().to_string();
            dbg!(path);
        }
    }
  };



      //let deserializer = &mut serde_json::Deserializer::from_str(&text);

  //let result: Result<CouchDBOuterResp<EscrowValue>, _> = serde_path_to_error::deserialize(deserializer);
  // dbg!(&result);

  // match result {
  //     Ok(_) => println!("Expected an error"),
  //     Err(err) => {
  //         panic!("{}", err);
  //     }
  // }

  //let result: CouchDBOuterResp = serde_json::from_str(&text)?;


  // let result: CouchDBOuterResp = resp.json().await?;


  //return Err("Error...".into());
  return Ok(result?);
}


pub async fn query_couch_db_with_full_str<T: DeserializeOwned>(couch_url: &String, db_name: &String, index_name: &String, 
  view_name: &String, full_query_str: &String)
  -> Result<(CouchDBResp<T>), Box<dyn Error>> 
  {

  let client = reqwest::Client::new();

  let full = format!("{}/{}/_design/{}/_view/{}?{}",
      couch_url, db_name, index_name, view_name, full_query_str);

  let resp = client.get(full)
      //.header(reqwest::header::CONTENT_TYPE, "application/json")
      .send()
      .await?;

  let res = resp.text().await?;

  if (res.contains("\"error\":\"unauthorized\"")) {
    panic!("{res}");
  }

  let result: Result<CouchDBResp<T>,_> = serde_json::from_str(&res);

  if let Err(_) = &result {
    println!("{res}");
    let jd = &mut serde_json::Deserializer::from_str(&res);
    let result2: Result<CouchDBResp<T>, _> = serde_path_to_error::deserialize(jd);
    match &result2 {
        Ok(_) => {},
        Err(err) => {
            let path = err.path().to_string();
            dbg!(path);
        }
    }
  };

  return Ok(result?);
}

