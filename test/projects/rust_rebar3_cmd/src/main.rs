use std::env;
use std::process;
use std::string;

// an example function...
fn main() {
    let key = "PATH";
    match env::var(key) {
        Ok(val) => println!("{key}: {val:?}"),
        Err(e) => println!("couldn't interpret {key}: {e}"),
    }
}

#[allow(dead_code)]
fn rebar3_cmd_version() -> Result<String, string::FromUtf8Error> {
    println!("going for rebar3.cmd");
    let output = process::Command::new("rebar3.cmd")
        .arg("version")
        .output()
        .expect("error");
    return String::from_utf8(output.stdout);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        rebar3_cmd_version().unwrap();
    }
}
