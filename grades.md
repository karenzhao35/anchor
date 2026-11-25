# Individual grades

### Task 1 (downloader)

**u1a:  You download a file without naming where to save it, and httpie saves it as report-2026.pdf, a name that isn’t in the URL you typed. Which part of httpie picks that name, and what information does it use?**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | It checks the name for the URL and guesses rhe extension. | 1 |
| P2 | def filename_from_content_disposition(<br>    content_disposition: str<br>)<br>It uses the content disposition from the file | 2 |
| P4 | idk | 0 |
| P3 | get_output_file_from_response in dowloads.py picks that name and it uses the content disposition to get the name name | 2 |
| P5 | this chunk in start if not self._output_file:<br>            self._output_file = self._get_output_file_from_response(<br>                initial_url=initial_url,<br>                final_response=final_response,<br>            ) | 1 |

**u1b: The connection drops halfway through a large download, and httpie exits with an error saying the download was incomplete. Which part(s) of the code notice this, and what do they compare to decide it?**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | It throws an error in core.py and it knows by comparing the downloaded bytes with the total bytes in downloader.py. | 2 |
| P2 | def interrupted(self) -> bool:<br>        return (<br>            self.finished<br>            and self.status.total_size<br>            and self.status.total_size != self.status.downloaded<br>        )<br>Check if the current download size is the same as the expected total size of the file | 2 |
| P4 | I dont know | 0 |
| P3 | The program() method in core.py notices this. It calls arg.check_status and creates an exit_status using the http status. | 1 |
| P5 | DownloadStatus, probably in core.py | 1 |

**u2a: forced redirect-following**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | This is because of CDNs, it could get a redirect and so if it didn’t follow you would download a redirect response instead of the file. I don’t know where it does this. Maybe in core? | 2 |
| P2 | stream = RawStream(<br>            msg=HTTPResponse(final_response),<br>            output_options=output_options,<br>            on_body_chunk_downloaded=self.chunk_downloaded,<br>        ) | 0 |
| P4 | idk | 0 |
| P3 | The program method in core.py automatically switches on redirect in the args parameter before calling the Downloader(). I'm not sure what would end up on the disk if it didn't. I guess it depends on if the URL we are calling has a redirect before we get a response back. So if there is a redirect, and we don't redirect then there will be nothing downloaded to disk. | 2 |
| P5 | I don't see a redirect in the files I looked at | 0 |

**u2b:  httpie refuses to resume an interrupted download unless you name the output file yourself. What does the code need to know in order to resume, and at what point does it need it? Use that to explain why a name httpie picks itself won’t work.**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | It needs to know the interrupted file to continue downloading since you might have given it a different name. It will continue from the current downloaded bytes. | 1 |
| P2 | The downloader class needs resume = true and a provided name. It requires this to check the progress of the already started download file and see which byte it needs to resume progress from. A httpie generated name is not garuanteed to refer to a file that exists. | 1 *borderline* |
| P4 | It needs the request header in order to resume, and is needed on line 233 when a file is partially downloaded. The code requires to the response to get the headers | 1 |
| P3 | FYI I used Anchor for this!<br><br>It needs to know the name of the output file and where to resume from/what content range still needs to be parsed. httpie picks out a name for itself by calling get_unique_name which creates a new name that is unique in the file system, so it won't be able to append the interrupted download to that original output file. | 2 |
| P5 | downloader.status.total_size and downloader.status.downloaded to make error message. | 0 |

### Task 2 (sessions)

**u1a: which headers the session keeps**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | Not sure | 0 |
| P2 | # Default values for the session files<br>        self['headers'] = []<br>        self['cookies'] = []<br>        self['auth'] = {<br>            'type': None,<br>            'username': None,<br>            'password': None<br>        }<br><br>This part of the code dictates what is stored in the session json file | 0 |
| P4 | The session keeps the header that is newer over the existing one and overrides them directly | 0 |
| P3 | compute_new_headers in sessions.py. It uses the new values unless the new values don't pass a certain series of if statements. | 1 |
| P5 | I think it was already stored as default_headers['Content-Type'] = JSON_CONTENT_TYPE somewhere in data so and then set in # If sending files, `requests` will set<br>        # the `Content-Type` for us.<br>        default_headers['Content-Type'] = FORM_CONTENT_TYPE<br><br>all of this is in apply_missing_repeated_headers in client.py | 0 |

**u1b: expired cookie dropped**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | the cookie jar has a clear expired cookies fn and it compares the expiry time to cur time | 2 |
| P2 | Upon a session load, _add_cookies loads all the cookies stored in the cookiejar and cookies marked "expired" are removed. There is a clear cookies helper function. | 1 |
| P4 | Expired cookies are dropped when a new session is made, and the cookies are compared by name | 1 |
| P3 | When the cookies attribute of the session is used, it first calls the clear_expired_cookies method from the cookie jar library before returning the property. I'm not sure what the code compares because I didn't look into the library implementation | 1 |
| P5 | sessions.py calls clear_expired_cookies from cookiejar.py, which clears all cookies and it then calls clear which removes it by path. | 1 |

**u2a: sessions tied to a host**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | the session is saved to a file with the hostname like api.exmaple.com, if u try to use that sesion in other.example.com it cafnt find the file. this prevents unauthorized users from logging in to an admin subdomain, for example. | 2 |
| P2 | Bounded by bound host, prevents abuse of auth cookies for access control | 2 |
| P4 | Session,load()'s token is based off of the user's login URL, which prevents concurrency issues. | 1 |
| P3 | It keeps it apart by storing the session state under different directories for different hosts. This prevents sharing authorizations and cookies on different hosts which could be insecure. | 2 |
| P5 | I think they get separated by the property materialized_cookie['domain'] | 1 *borderline* |

**u2b: command line wins, then persists**

| Person | Response | Grade |
| --- | --- | --- |
| P1 | new headers take priority over old ones. since the session already exists the update session fn is called which adds the new one. | 2 |
| P2 | Every time a request is sent, a session file is created or updated, and then it is loaded for the request to be sent. | 1 |
| P4 | at some point in the session the header with Token: old would have been stored, the session would load the old token as it is being sent. The data is processed with certain headers being ignored, and then header is updated with the new token | 1 |
| P3 | There is a save() method in a file (I forgot which file) that saves the state of the session to disk. Then there is a method get_httpie_session() that fetches that saved session from disk. It then uses the old state and replaces the X-Token with the new value from the command line before making the request (somewhere, I'm not sure where the caller of get_httpie_session() is) | 1 *borderline* |
| P5 | update_headers in sessions.py gets new keys/headers and overrides them when possible. | 1 |
