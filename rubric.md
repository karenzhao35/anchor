
| Question | 0                   | 1                             | 2                                                                                                                                                                                                  |
| -------- | ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **u1a**  | Incorrect response. | Only mentions one of the two. | The code regarding `_get_output_file_from_response` **and** that it uses the server-suggested name from the header.                                                                                |
| **u1b**  | Incorrect response. | Only mentions one of the two. | A correct location (the downloader, `DownloadStatus`, or the end-of-run check in `core.py`) **and** the downloaded-bytes vs. expected-size comparison.                                             |
| **u2a**  | Incorrect response. | Only mentions one of the two. | Understanding demonstrated that either nothing would end up on disk or just a redirect response **and** that we are downloading the final response so we want to follow redirects to acheive such. |
| **u2b**  | Incorrect response. | Only mentions one of the two. | Mentions that resuming needs the partial downloaded file and how much is already on disk **and** that a self-picked name is unique, so it would not lead back to the same partial file.            |

| Question | 0 | 1 | 2 |
| --- | --- | --- | --- |
| **u1a** (U1) | Incorrect response. | Only mentions one of the two. | Where the session's header gets updated **and** mention that request-specific headers are skipped. |
| **u1b** (U1) | Incorrect response. | Only mentions one of the two. | Mentions that the expired cookies are cleared when they are read **and** the cookie's expiry time compared against the current time. |
| **u2a** (U2) | Incorrect response. | Only mentions one of the two. | Understanding that sessions are stored separately per host **and** explanation that this prevents security issues. |
| **u2b** (U2) | Incorrect response. | Only mentions one of the two. | Understanding that `new` is sent because command-line headers override the session's when the request is built **and** mention the session is updated and saved. |

